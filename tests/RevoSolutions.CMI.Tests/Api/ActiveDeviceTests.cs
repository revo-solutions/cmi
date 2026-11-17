using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using RevoSolutions.CMI.API.Models;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

[Collection(ApiCollection.Name)]
public class ActiveDeviceTests
{
    private readonly CmiApiFactory _factory;

    public ActiveDeviceTests(CmiApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Signing_in_on_another_device_refuses_the_previous_one()
    {
        var subject = CmiApiFactory.NewSubject();
        var oldTokens = await _factory.Login(subject, Guid.NewGuid());
        var newDevice = await _factory.SignedInClient(subject, Guid.NewGuid());

        (await _factory.Client(oldTokens).GetAsync("/api/v1/sync")).StatusCode.Should().Be(HttpStatusCode.Conflict);
        (await newDevice.GetAsync("/api/v1/sync")).StatusCode.Should().Be(HttpStatusCode.OK);

        // A refresh keeps the session on its device, so it doesn't sneak the old phone back in.
        var refreshed = await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(oldTokens.RefreshToken));
        var refreshedTokens = (await refreshed.Content.ReadFromJsonAsync<TokenResponse>(CmiApiFactory.Json))!;
        (await _factory.Client(refreshedTokens).GetAsync("/api/v1/sync")).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task The_previous_device_can_take_the_account_back()
    {
        var subject = CmiApiFactory.NewSubject();
        var oldDevice = await _factory.SignedInClient(subject, Guid.NewGuid());
        var newDevice = await _factory.SignedInClient(subject, Guid.NewGuid());

        (await oldDevice.PutAsync("/api/v1/account/active-device", null)).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await oldDevice.GetAsync("/api/v1/sync")).StatusCode.Should().Be(HttpStatusCode.OK);
        (await newDevice.GetAsync("/api/v1/sync")).StatusCode.Should().Be(HttpStatusCode.Conflict);
    }
}
