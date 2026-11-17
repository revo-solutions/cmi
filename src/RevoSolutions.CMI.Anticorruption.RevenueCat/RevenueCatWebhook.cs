using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Anticorruption.RevenueCat;

// An event only says whose subscription changed. Their Premium is read back from RevenueCat's API, as RevenueCat
// recommends, so refunds, transfers, repeated and out-of-order events need no rules of their own.
public sealed class RevenueCatWebhook
{
    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly RevenueCatSettings _settings;
    private readonly RevenueCatClient _client;
    private readonly IRepository<Account> _accounts;
    private readonly IUnitOfWork _unitOfWork;

    public RevenueCatWebhook(RevenueCatSettings settings, RevenueCatClient client, IRepository<Account> accounts, IUnitOfWork unitOfWork)
    {
        _settings = settings;
        _client = client;
        _accounts = accounts;
        _unitOfWork = unitOfWork;
    }

    public bool IsAuthorized(string? authorization) =>
        !string.IsNullOrEmpty(_settings.WebhookAuthorization)
        && authorization is not null
        && CryptographicOperations.FixedTimeEquals(Encoding.UTF8.GetBytes(authorization), Encoding.UTF8.GetBytes(_settings.WebhookAuthorization));

    // A failure here makes RevenueCat retry the call, for about 80 minutes.
    public async Task Receive(byte[] body, CancellationToken cancellationToken = default)
    {
        var e = JsonSerializer.Deserialize<Payload>(body, Json)?.Event;
        if (e is null)
        {
            return;
        }

        // The app user id is the account id; anything else (the dashboard's test, an anonymous buyer) is no account.
        var accountIds = new[] { e.AppUserId, e.OriginalAppUserId }
            .Concat(e.Aliases ?? [])
            .Concat(e.TransferredFrom ?? [])
            .Concat(e.TransferredTo ?? [])
            .Select(id => Guid.TryParse(id, out var accountId) ? accountId : Guid.Empty)
            .Where(id => id != Guid.Empty)
            .Distinct();

        foreach (var accountId in accountIds)
        {
            if (await _accounts.FirstOrDefault(a => a.Id == accountId) is { } account)
            {
                account.PremiumUntil = await _client.PremiumUntil(accountId, cancellationToken);
            }
        }

        await _unitOfWork.CommitAsync();
    }

    private sealed record Payload(Event? Event);

    private sealed record Event(
        [property: JsonPropertyName("app_user_id")] string? AppUserId,
        [property: JsonPropertyName("original_app_user_id")] string? OriginalAppUserId,
        IReadOnlyList<string>? Aliases,
        [property: JsonPropertyName("transferred_from")] IReadOnlyList<string>? TransferredFrom,
        [property: JsonPropertyName("transferred_to")] IReadOnlyList<string>? TransferredTo);
}
