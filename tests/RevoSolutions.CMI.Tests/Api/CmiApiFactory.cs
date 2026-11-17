using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RevoSolutions.CMI.Anticorruption.ExpoPush;
using RevoSolutions.CMI.Anticorruption.RevenueCat;
using RevoSolutions.CMI.Anticorruption.WhatsApp;
using RevoSolutions.CMI.API.Authentication;
using RevoSolutions.CMI.API.Models;
using RevoSolutions.CMI.API.Notices;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
using RevoSolutions.CMI.Domain.Contracts.Push;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Enumerators;
using Testcontainers.PostgreSql;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

[CollectionDefinition(Name)]
public sealed class ApiCollection : ICollectionFixture<CmiApiFactory>
{
    public const string Name = "Api";
}

// One throwaway Postgres (Docker required), migrated from scratch, shared by every API test. Each test signs in with
// its own subject, so tests never see each other's accounts.
public sealed class CmiApiFactory : WebApplicationFactory<RevoSolutions.CMI.API.Program>, IAsyncLifetime
{
    // The API writes enums by name (see Program.cs); the web defaults alone only read numbers.
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web) { Converters = { new JsonStringEnumConverter() } };

    private readonly PostgreSqlContainer _postgres = new PostgreSqlBuilder("postgres:17").Build();

    public static readonly WhatsAppSettings WhatsAppSettings = new()
    {
        PhoneNumberId = "100000000000000",
        AccessToken = "test-access-token",
        AppSecret = "test-app-secret",
        VerifyToken = "test-verify-token",
    };

    public static readonly RevenueCatSettings RevenueCatSettings = new()
    {
        ApiKey = "test-api-key",
        WebhookAuthorization = "test-webhook-authorization",
    };

    public FakeWhatsApp WhatsApp { get; } = new();

    public FakeRevenueCat RevenueCat { get; } = new();

    public FakeExpoPush ExpoPush { get; } = new();

    // A token of its own for each test, so tests never see each other's pushes.
    public static string NewPushToken() => $"ExponentPushToken[{Guid.NewGuid():N}]";

    public static string NewSubject() => Guid.NewGuid().ToString("N");

    // A number of its own for each test, so tests never see each other's messages.
    public static string NewWhatsAppNumber() => $"5511{Random.Shared.Next(100_000_000, 1_000_000_000)}";

    // A message from the family member, as Meta's webhook delivers it, signed with the app secret.
    public async Task<HttpResponseMessage> ReceiveWhatsApp(string from, string text)
    {
        var body = JsonSerializer.Serialize(new
        {
            @object = "whatsapp_business_account",
            entry = new[]
            {
                new
                {
                    id = "1",
                    changes = new[]
                    {
                        new
                        {
                            field = "messages",
                            value = new { messages = new[] { new { from, id = $"wamid.{Guid.NewGuid():N}", type = "text", text = new { body = text } } } },
                        },
                    },
                },
            },
        });

        return await PostWhatsApp(body, Sign(body));
    }

    public async Task<HttpResponseMessage> PostWhatsApp(string body, string? signature)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/webhooks/whatsapp")
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        };
        if (signature is not null)
        {
            request.Headers.Add("X-Hub-Signature-256", signature);
        }

        return await CreateClient().SendAsync(request);
    }

    // The store reports a change: RevenueCat now holds Premium until `until` (none if null) and calls the webhook.
    public async Task SetPremium(Guid accountId, DateTimeOffset? until, string type = "INITIAL_PURCHASE")
    {
        if (until is null)
        {
            RevenueCat.Remove(accountId);
        }
        else
        {
            RevenueCat.Set(accountId, until);
        }

        (await PostRevenueCat(RevenueCatEvent(type, accountId))).EnsureSuccessStatusCode();
    }

    public static object RevenueCatEvent(string type, Guid accountId) =>
        new { type, app_user_id = $"{accountId}", original_app_user_id = $"{accountId}", aliases = new[] { $"{accountId}" } };

    public async Task<HttpResponseMessage> PostRevenueCat(object @event, string? authorization = null)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, "/api/v1/webhooks/revenuecat")
        {
            Content = JsonContent.Create(new { api_version = "1.0", @event }),
        };
        request.Headers.TryAddWithoutValidation("Authorization", authorization ?? RevenueCatSettings.WebhookAuthorization);

        return await CreateClient().SendAsync(request);
    }

    public static string Sign(string body) =>
        "sha256=" + Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(WhatsAppSettings.AppSecret), Encoding.UTF8.GetBytes(body)));

    public async Task InitializeAsync()
    {
        await _postgres.StartAsync();

        using var scope = Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<CmiDbContext>().Database.MigrateAsync();
    }

    public async Task<TokenResponse> Login(string subject, Guid deviceId)
    {
        var response = await CreateClient().PostAsJsonAsync("/api/v1/auth/login", new LoginRequest(LoginProvider.Google, subject, deviceId), Json);
        response.StatusCode.Should().Be(HttpStatusCode.OK);

        return (await response.Content.ReadFromJsonAsync<TokenResponse>(Json))!;
    }

    public HttpClient Client(TokenResponse tokens)
    {
        var client = CreateClient();
        client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

        return client;
    }

    public async Task<HttpClient> SignedInClient(string subject, Guid deviceId) => Client(await Login(subject, deviceId));

    // For what the API stores but never sends back, such as the device's facts.
    public async Task<Account> StoredAccount(string subject)
    {
        using var scope = Services.CreateScope();

        return await scope.ServiceProvider.GetRequiredService<CmiDbContext>().Accounts
            .AsNoTracking()
            .SingleAsync(a => a.Subject == subject);
    }

    async Task IAsyncLifetime.DisposeAsync()
    {
        await DisposeAsync();
        await _postgres.DisposeAsync();
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseSetting("ConnectionStrings:CmiConnection", _postgres.GetConnectionString());

        builder.ConfigureServices(services =>
        {
            services.RemoveAll<ISocialTokenValidator>();
            services.AddSingleton<ISocialTokenValidator, FakeSocialTokenValidator>();

            // Tests run the rules and the outbox themselves, at the instants they choose.
            foreach (var worker in services.Where(s => s.ImplementationType == typeof(NoticeWorker) || s.ImplementationType == typeof(OutboxWorker)).ToList())
            {
                services.Remove(worker);
            }

            services.RemoveAll<WhatsAppSettings>();
            services.AddSingleton(WhatsAppSettings);
            services.AddHttpClient<WhatsAppClient>().ConfigurePrimaryHttpMessageHandler(() => WhatsApp);

            services.RemoveAll<RevenueCatSettings>();
            services.AddSingleton(RevenueCatSettings);
            services.AddHttpClient<RevenueCatClient>().ConfigurePrimaryHttpMessageHandler(() => RevenueCat);

            services.AddHttpClient<IPushSender, ExpoPushClient>().ConfigurePrimaryHttpMessageHandler(() => ExpoPush);
        });
    }

    // The ID token is the subject itself; "invalid" is what a forged or expired token looks like.
    private sealed class FakeSocialTokenValidator : ISocialTokenValidator
    {
        public Task<SocialIdentity?> Validate(LoginProvider provider, string idToken, CancellationToken cancellationToken = default) =>
            Task.FromResult(idToken == "invalid" ? null : new SocialIdentity(idToken, $"{idToken}@example.com"));
    }
}
