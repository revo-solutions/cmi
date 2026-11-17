using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Serialization;
using FluentAssertions;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;
using RevoSolutions.CMI.API.Authentication;
using RevoSolutions.CMI.API.Models;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
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

    public static string NewSubject() => Guid.NewGuid().ToString("N");

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
        });
    }

    // The ID token is the subject itself; "invalid" is what a forged or expired token looks like.
    private sealed class FakeSocialTokenValidator : ISocialTokenValidator
    {
        public Task<SocialIdentity?> Validate(LoginProvider provider, string idToken, CancellationToken cancellationToken = default) =>
            Task.FromResult(idToken == "invalid" ? null : new SocialIdentity(idToken, $"{idToken}@example.com"));
    }
}
