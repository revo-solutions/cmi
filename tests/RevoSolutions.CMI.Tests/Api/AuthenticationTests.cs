using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using RevoSolutions.CMI.API.Models;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

[Collection(ApiCollection.Name)]
public class AuthenticationTests
{
    private readonly CmiApiFactory _factory;

    public AuthenticationTests(CmiApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Sync_requires_a_token()
    {
        var response = await _factory.CreateClient().GetAsync("/api/v1/sync");

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Invalid_id_token_is_rejected()
    {
        var response = await _factory.CreateClient().PostAsJsonAsync(
            "/api/v1/auth/login",
            new LoginRequest(LoginProvider.Google, "invalid", Guid.NewGuid()),
            CmiApiFactory.Json);

        response.StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Refresh_issues_a_new_pair_for_the_same_device()
    {
        var tokens = await _factory.Login(CmiApiFactory.NewSubject(), Guid.NewGuid());

        var refreshed = await Refresh(tokens.RefreshToken);

        refreshed.StatusCode.Should().Be(HttpStatusCode.OK);
        var newTokens = (await refreshed.Content.ReadFromJsonAsync<TokenResponse>(CmiApiFactory.Json))!;
        newTokens.RefreshToken.Should().NotBe(tokens.RefreshToken);
        (await _factory.Client(newTokens).GetAsync("/api/v1/sync")).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Logout_ends_the_session()
    {
        var tokens = await _factory.Login(CmiApiFactory.NewSubject(), Guid.NewGuid());

        (await _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/logout", new RefreshRequest(tokens.RefreshToken)))
            .StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await Refresh(tokens.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
    }

    [Fact]
    public async Task Deleting_the_account_deletes_everything()
    {
        var subject = CmiApiFactory.NewSubject();
        var tokens = await _factory.Login(subject, Guid.NewGuid());
        var client = _factory.Client(tokens);
        var medication = new MedicationModel(Guid.NewGuid(), "Losartana", "50 mg", [new TimeOnly(8, 0)], false, false, DateTimeOffset.UtcNow);
        var changes = new SyncModel
        {
            Medications = [medication],
            DoseRecords = [new DoseRecordModel(Guid.NewGuid(), medication.Id, new DateOnly(2026, 11, 16), new TimeOnly(8, 0), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow)],
            Contacts = [new ContactModel(Guid.NewGuid(), "Ana", "+5511999990000", Relationship.Mother, false, DateTimeOffset.UtcNow)],
        };
        (await client.PostAsJsonAsync("/api/v1/sync", changes, CmiApiFactory.Json)).EnsureSuccessStatusCode();

        (await client.DeleteAsync("/api/v1/account")).StatusCode.Should().Be(HttpStatusCode.NoContent);

        (await client.GetAsync("/api/v1/sync")).StatusCode.Should().Be(HttpStatusCode.NotFound);
        (await Refresh(tokens.RefreshToken)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);

        var fresh = await _factory.SignedInClient(subject, Guid.NewGuid());
        var download = (await fresh.GetFromJsonAsync<SyncModel>("/api/v1/sync", CmiApiFactory.Json))!;
        download.Medications.Should().BeEmpty();
        download.DoseRecords.Should().BeEmpty();
        download.Contacts.Should().BeEmpty();
    }

    private Task<HttpResponseMessage> Refresh(string refreshToken) =>
        _factory.CreateClient().PostAsJsonAsync("/api/v1/auth/refresh", new RefreshRequest(refreshToken));
}
