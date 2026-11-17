using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace RevoSolutions.CMI.Anticorruption.RevenueCat;

// RevenueCat's REST API (v1), read for the customer's current state.
public sealed class RevenueCatClient
{
    private readonly HttpClient _http;
    private readonly RevenueCatSettings _settings;

    public RevenueCatClient(HttpClient http, RevenueCatSettings settings)
    {
        _http = http;
        _settings = settings;
    }

    // When Premium ends, counting the store's grace period: null without the entitlement, the far future for one that
    // never expires. An expired entitlement is still listed, with its past date.
    public async Task<DateTime?> PremiumUntil(Guid accountId, CancellationToken cancellationToken = default)
    {
        var response = await _http.GetFromJsonAsync<CustomerResponse>($"subscribers/{accountId}", cancellationToken);
        if (response?.Subscriber.Entitlements?.GetValueOrDefault(_settings.EntitlementId) is not { } entitlement)
        {
            return null;
        }

        if (entitlement.ExpiresDate is not { } expires)
        {
            return DateTime.MaxValue;
        }

        return (entitlement.GracePeriodExpiresDate > expires ? entitlement.GracePeriodExpiresDate.Value : expires).UtcDateTime;
    }

    private sealed record CustomerResponse(Subscriber Subscriber);

    private sealed record Subscriber(IReadOnlyDictionary<string, Entitlement>? Entitlements);

    private sealed record Entitlement(
        [property: JsonPropertyName("expires_date")] DateTimeOffset? ExpiresDate,
        [property: JsonPropertyName("grace_period_expires_date")] DateTimeOffset? GracePeriodExpiresDate);
}
