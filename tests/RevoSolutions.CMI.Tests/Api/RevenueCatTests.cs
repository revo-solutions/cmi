using System.Net;
using FluentAssertions;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

[Collection(ApiCollection.Name)]
public class RevenueCatTests
{
    private readonly CmiApiFactory _factory;

    public RevenueCatTests(CmiApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task A_purchase_makes_the_account_premium_until_the_grace_period_ends()
    {
        var (subject, accountId) = await NewAccount();
        var expires = DateTimeOffset.UtcNow.AddMonths(1);
        _factory.RevenueCat.Set(accountId, expires, expires.AddDays(3));

        (await _factory.PostRevenueCat(CmiApiFactory.RevenueCatEvent("INITIAL_PURCHASE", accountId))).StatusCode.Should().Be(HttpStatusCode.OK);

        (await _factory.StoredAccount(subject)).PremiumUntil.Should().BeCloseTo(expires.AddDays(3).UtcDateTime, TimeSpan.FromMilliseconds(1));
    }

    [Fact]
    public async Task An_entitlement_that_never_expires_is_premium_for_good()
    {
        var (subject, accountId) = await NewAccount();
        _factory.RevenueCat.Set(accountId, null);

        (await _factory.PostRevenueCat(CmiApiFactory.RevenueCatEvent("NON_RENEWING_PURCHASE", accountId))).EnsureSuccessStatusCode();

        (await _factory.StoredAccount(subject)).IsPremium(DateTime.UtcNow.AddYears(100)).Should().BeTrue();
    }

    [Fact]
    public async Task A_call_without_the_dashboards_authorization_is_refused()
    {
        var (subject, accountId) = await NewAccount();
        _factory.RevenueCat.Set(accountId, DateTimeOffset.UtcNow.AddMonths(1));

        (await _factory.PostRevenueCat(CmiApiFactory.RevenueCatEvent("INITIAL_PURCHASE", accountId), "forged")).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await _factory.PostRevenueCat(CmiApiFactory.RevenueCatEvent("INITIAL_PURCHASE", accountId), string.Empty)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        (await _factory.StoredAccount(subject)).PremiumUntil.Should().BeNull();
    }

    [Fact]
    public async Task A_transfer_moves_premium_from_one_account_to_the_other()
    {
        var (fromSubject, fromId) = await NewAccount();
        var (toSubject, toId) = await NewAccount();
        await _factory.SetPremium(fromId, DateTimeOffset.UtcNow.AddMonths(1));

        _factory.RevenueCat.Remove(fromId);
        _factory.RevenueCat.Set(toId, DateTimeOffset.UtcNow.AddMonths(1));
        (await _factory.PostRevenueCat(new { type = "TRANSFER", transferred_from = new[] { $"{fromId}" }, transferred_to = new[] { $"{toId}" } }))
            .EnsureSuccessStatusCode();

        (await _factory.StoredAccount(fromSubject)).PremiumUntil.Should().BeNull();
        (await _factory.StoredAccount(toSubject)).IsPremium(DateTime.UtcNow).Should().BeTrue();
    }

    [Fact]
    public async Task An_event_about_no_account_is_accepted()
    {
        var response = await _factory.PostRevenueCat(new { type = "TEST", app_user_id = "$RCAnonymousID:abc", aliases = new[] { "$RCAnonymousID:abc" } });

        response.StatusCode.Should().Be(HttpStatusCode.OK);
    }

    private async Task<(string Subject, Guid AccountId)> NewAccount()
    {
        var subject = CmiApiFactory.NewSubject();
        await _factory.Login(subject, Guid.NewGuid());

        return (subject, (await _factory.StoredAccount(subject)).Id);
    }
}
