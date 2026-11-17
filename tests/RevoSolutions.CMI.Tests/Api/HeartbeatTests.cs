using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

[Collection(ApiCollection.Name)]
public class HeartbeatTests
{
    private const string PushToken = "ExponentPushToken[abc123]";

    private readonly CmiApiFactory _factory;

    public HeartbeatTests(CmiApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task A_heartbeat_records_the_device_and_the_contact()
    {
        var subject = CmiApiFactory.NewSubject();
        var phone = await _factory.SignedInClient(subject, Guid.NewGuid());
        var before = DateTime.UtcNow;

        var response = await Heartbeat(phone, new HeartbeatModel(DevicePlatform.Ios, "America/Sao_Paulo", PushToken));

        response.StatusCode.Should().Be(HttpStatusCode.NoContent);
        var account = await _factory.StoredAccount(subject);
        account.Platform.Should().Be(DevicePlatform.Ios);
        account.TimeZone.Should().Be("America/Sao_Paulo");
        account.PushToken.Should().Be(PushToken);
        account.LastSeenAt.Should().BeOnOrAfter(before.AddSeconds(-1));
    }

    [Fact]
    public async Task An_upload_counts_as_contact()
    {
        var subject = CmiApiFactory.NewSubject();
        var phone = await _factory.SignedInClient(subject, Guid.NewGuid());
        var afterLogin = (await _factory.StoredAccount(subject)).LastSeenAt;

        (await phone.PostAsJsonAsync("/api/v1/sync", new SyncModel(), CmiApiFactory.Json)).EnsureSuccessStatusCode();

        (await _factory.StoredAccount(subject)).LastSeenAt.Should().BeAfter(afterLogin!.Value);
    }

    [Fact]
    public async Task An_unknown_time_zone_is_rejected()
    {
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());

        var response = await Heartbeat(phone, new HeartbeatModel(DevicePlatform.Android, "Brasília", null));

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task A_new_device_drops_the_old_push_token_and_the_old_device_is_refused()
    {
        var subject = CmiApiFactory.NewSubject();
        var oldPhone = await _factory.SignedInClient(subject, Guid.NewGuid());
        await Heartbeat(oldPhone, new HeartbeatModel(DevicePlatform.Android, "America/Sao_Paulo", PushToken));

        await _factory.Login(subject, Guid.NewGuid());

        (await _factory.StoredAccount(subject)).PushToken.Should().BeNull();
        (await Heartbeat(oldPhone, new HeartbeatModel(DevicePlatform.Android, "America/Sao_Paulo", PushToken)))
            .StatusCode.Should().Be(HttpStatusCode.Conflict);
    }

    private static Task<HttpResponseMessage> Heartbeat(HttpClient client, HeartbeatModel heartbeat) =>
        client.PostAsJsonAsync("/api/v1/sync/heartbeat", heartbeat, CmiApiFactory.Json);
}
