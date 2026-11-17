using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;

namespace RevoSolutions.CMI.Tests.Api;

// Stands in for RevenueCat's REST API: answers each customer with the Premium entitlement the test gave it, if any.
public sealed class FakeRevenueCat : HttpMessageHandler
{
    private readonly ConcurrentDictionary<Guid, object> _entitlements = new();

    public void Set(Guid accountId, DateTimeOffset? expires, DateTimeOffset? gracePeriodExpires = null) =>
        _entitlements[accountId] = new
        {
            expires_date = expires,
            grace_period_expires_date = gracePeriodExpires,
            product_identifier = "cmi_premium_mensal",
        };

    public void Remove(Guid accountId) => _entitlements.TryRemove(accountId, out _);

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        if (request.Headers.Authorization?.ToString() != $"Bearer {CmiApiFactory.RevenueCatSettings.ApiKey}")
        {
            return Task.FromResult(new HttpResponseMessage(HttpStatusCode.Unauthorized));
        }

        var accountId = Guid.Parse(request.RequestUri!.Segments[^1]);
        var entitlements = new Dictionary<string, object>();
        if (_entitlements.TryGetValue(accountId, out var entitlement))
        {
            entitlements["premium"] = entitlement;
        }

        var body = JsonSerializer.Serialize(new { subscriber = new { original_app_user_id = accountId.ToString(), entitlements } });

        return Task.FromResult(new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent(body, Encoding.UTF8, "application/json"),
        });
    }
}
