using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

[Collection(ApiCollection.Name)]
public class SyncTests
{
    private static readonly DateTimeOffset Start = new(2026, 11, 16, 11, 0, 0, TimeSpan.Zero);

    private readonly CmiApiFactory _factory;

    public SyncTests(CmiApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Everything_uploaded_comes_back_on_a_new_phone()
    {
        var subject = CmiApiFactory.NewSubject();
        var phone = await _factory.SignedInClient(subject, Guid.NewGuid());
        var profile = new ProfileModel(new DateOnly(1950, 3, 9), ["hipertensao", "outra"], "Glaucoma", true, false, true, Start);
        var medication = Medication(Start);
        var dose = Dose(medication.Id, takenAt: Start.AddMinutes(5), Start.AddMinutes(5));
        var contact = Contact(Start);

        await Upload(phone, new SyncModel { Profile = profile, Medications = [medication], DoseRecords = [dose], Contacts = [contact] });

        var newPhone = await _factory.SignedInClient(subject, Guid.NewGuid());
        var download = await Download(newPhone);

        download.Profile.Should().BeEquivalentTo(profile);
        download.Medications.Should().ContainSingle().Which.Should().BeEquivalentTo(medication);
        download.DoseRecords.Should().ContainSingle().Which.Should().BeEquivalentTo(dose);
        download.Contacts.Should().ContainSingle().Which.Should().BeEquivalentTo(contact);
    }

    [Fact]
    public async Task The_latest_change_wins()
    {
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());
        var original = Medication(Start);
        await Upload(phone, new SyncModel { Medications = [original] });

        await Upload(phone, new SyncModel { Medications = [original with { Name = "Stale", UpdatedAt = Start.AddMinutes(-1) }] });
        (await Download(phone)).Medications.Single().Name.Should().Be(original.Name);

        // Queued twice in one batch: the later change is the one kept.
        await Upload(phone, new SyncModel
        {
            Medications =
            [
                original with { Name = "Newest", Paused = true, UpdatedAt = Start.AddMinutes(2) },
                original with { Name = "Newer", UpdatedAt = Start.AddMinutes(1) },
            ],
        });
        var medication = (await Download(phone)).Medications.Single();
        medication.Name.Should().Be("Newest");
        medication.Paused.Should().BeTrue();
    }

    [Fact]
    public async Task Undoing_a_dose_clears_when_it_was_taken()
    {
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());
        var medication = Medication(Start);
        var dose = Dose(medication.Id, takenAt: Start, Start);
        await Upload(phone, new SyncModel { Medications = [medication], DoseRecords = [dose] });

        await Upload(phone, new SyncModel { DoseRecords = [dose with { TakenAt = null, UpdatedAt = Start.AddMinutes(1) }] });

        (await Download(phone)).DoseRecords.Single().TakenAt.Should().BeNull();
    }

    [Fact]
    public async Task A_deleted_contact_leaves_the_server()
    {
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());
        var contact = Contact(Start);
        await Upload(phone, new SyncModel { Contacts = [contact] });

        await Upload(phone, new SyncModel { Contacts = [contact with { Deleted = true, UpdatedAt = Start.AddMinutes(1) }] });

        (await Download(phone)).Contacts.Should().BeEmpty();
    }

    [Fact]
    public async Task Another_accounts_record_cannot_be_overwritten()
    {
        var owner = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());
        var medication = Medication(Start);
        await Upload(owner, new SyncModel { Medications = [medication] });

        var intruder = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());
        var response = await intruder.PostAsJsonAsync(
            "/api/v1/sync",
            new SyncModel { Medications = [medication with { Name = "Hijacked", UpdatedAt = Start.AddDays(1) }] },
            CmiApiFactory.Json);

        response.StatusCode.Should().Be(HttpStatusCode.Forbidden);
        (await Download(owner)).Medications.Single().Name.Should().Be(medication.Name);
    }

    [Fact]
    public async Task A_dose_of_an_unknown_medication_is_rejected()
    {
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());

        var response = await phone.PostAsJsonAsync(
            "/api/v1/sync",
            new SyncModel { DoseRecords = [Dose(Guid.NewGuid(), Start, Start)] },
            CmiApiFactory.Json);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    [Fact]
    public async Task Health_conditions_must_be_known_codes()
    {
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());

        var response = await phone.PostAsJsonAsync(
            "/api/v1/sync",
            new SyncModel { Profile = new ProfileModel(null, ["Pressão alta"], null, null, null, null, Start) },
            CmiApiFactory.Json);

        response.StatusCode.Should().Be(HttpStatusCode.BadRequest);
    }

    private static MedicationModel Medication(DateTimeOffset updatedAt) =>
        new(Guid.NewGuid(), "Losartana", "50 mg, 1 comprimido", [new TimeOnly(8, 0), new TimeOnly(20, 0)], false, false, updatedAt);

    private static DoseRecordModel Dose(Guid medicationId, DateTimeOffset? takenAt, DateTimeOffset updatedAt) =>
        new(Guid.NewGuid(), medicationId, new DateOnly(2026, 11, 16), new TimeOnly(8, 0), takenAt, updatedAt);

    private static ContactModel Contact(DateTimeOffset updatedAt) =>
        new(Guid.NewGuid(), "Ana", "+5511999990000", Relationship.Mother, false, updatedAt);

    private static async Task Upload(HttpClient client, SyncModel changes)
    {
        var response = await client.PostAsJsonAsync("/api/v1/sync", changes, CmiApiFactory.Json);
        response.StatusCode.Should().Be(HttpStatusCode.NoContent, await response.Content.ReadAsStringAsync());
    }

    private static async Task<SyncModel> Download(HttpClient client) =>
        (await client.GetFromJsonAsync<SyncModel>("/api/v1/sync", CmiApiFactory.Json))!;
}
