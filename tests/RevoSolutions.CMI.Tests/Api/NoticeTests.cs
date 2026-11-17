using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
using RevoSolutions.CMI.Data.PostgreSql.Outbox;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;
using RevoSolutions.CMI.Domain.Services;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

// The rules run at instants the tests choose; the device's last contact is the real clock at setup.
[Collection(ApiCollection.Name)]
public class NoticeTests
{
    private const string PushToken = "ExponentPushToken[abc123]";

    private static readonly TimeZoneInfo SaoPaulo = TimeZoneInfo.FindSystemTimeZoneById("America/Sao_Paulo");
    private static readonly DateTimeOffset LongAgo = DateTimeOffset.UtcNow.AddDays(-30);

    private readonly CmiApiFactory _factory;

    public NoticeTests(CmiApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task A_missed_dose_is_notified_once_and_sent_through_the_outbox()
    {
        var now = DaytimeNow();
        var (date, time) = LocalMinutesAgo(now, 65);
        var accountId = await Person(new SyncModel { Medications = [Medication(time)] });

        await Check(accountId, now);
        await Check(accountId, now.AddMinutes(1));

        var notice = (await Notices(accountId)).Should().ContainSingle(n => n.Kind == NoticeKind.MissedDose).Subject;
        notice.Day.Should().Be(date);
        notice.ScheduledTime.Should().Be(time);

        await ProcessOutbox();

        _factory.Sender.Sent.Should().ContainSingle(s => s.NoticeId == notice.Id);
        (await Notices(accountId)).Single(n => n.Id == notice.Id).SentAt.Should().NotBeNull();
    }

    [Fact]
    public async Task A_taken_dose_or_an_unshared_medication_sends_nothing()
    {
        var now = DaytimeNow();
        var (date, time) = LocalMinutesAgo(now, 65);
        var taken = Medication(time);
        var accountId = await Person(new SyncModel
        {
            Medications = [taken, Medication(time) with { SharedWithContact = false }],
            DoseRecords = [new DoseRecordModel(Guid.NewGuid(), taken.Id, date, time, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow)],
        });

        await Check(accountId, now);

        (await Notices(accountId)).Should().NotContain(n => n.Kind == NoticeKind.MissedDose);
    }

    [Fact]
    public async Task Without_recent_contact_a_missed_dose_waits_for_the_summary()
    {
        var later = DaytimeNow().AddHours(7);
        var (_, time) = LocalMinutesAgo(later, 65);
        var accountId = await Person(new SyncModel { Medications = [Medication(time)] });

        await Check(accountId, later);

        (await Notices(accountId)).Should().NotContain(n => n.Kind == NoticeKind.MissedDose);
    }

    [Fact]
    public async Task Doses_at_the_same_time_are_one_notice_and_a_day_has_at_most_three()
    {
        var now = DaytimeNow();
        var times = new[] { 80, 75, 70, 65 }.Select(minutes => LocalMinutesAgo(now, minutes).Time).ToList();
        var accountId = await Person(new SyncModel { Medications = [Medication([.. times]), Medication(times[0])] });

        await Check(accountId, now);

        (await Notices(accountId)).Where(n => n.Kind == NoticeKind.MissedDose).Select(n => n.ScheduledTime)
            .Should().BeEquivalentTo(times.Take(3));
    }

    [Fact]
    public async Task A_silent_phone_is_pinged_first_and_the_family_told_once()
    {
        var accountId = await Person(new SyncModel(), PushToken);
        var silent = DateTime.UtcNow.AddHours(12).AddMinutes(1);

        await Check(accountId, silent);
        (await Notices(accountId)).Should().NotContain(n => n.Kind == NoticeKind.NoContact);
        (await Account(accountId)).PingSentAt.Should().Be(silent);

        await Check(accountId, silent.AddMinutes(31));
        await Check(accountId, silent.AddHours(5));
        (await Notices(accountId)).Should().ContainSingle(n => n.Kind == NoticeKind.NoContact);
    }

    [Fact]
    public async Task An_iphone_gets_a_day_before_it_counts_as_silent()
    {
        var accountId = await Person(new SyncModel(), PushToken, DevicePlatform.Ios);

        await Check(accountId, DateTime.UtcNow.AddHours(13));

        (await Account(accountId)).PingSentAt.Should().BeNull();
    }

    [Fact]
    public async Task Days_without_a_dose_pause_the_notices_until_the_next_tomei()
    {
        var medication = Medication(new TimeOnly(8, 0));
        var (accountId, phone) = await PersonWithPhone(new SyncModel { Medications = [medication] });
        var evening = LocalToUtc(DateOnly.FromDateTime(Local(DateTime.UtcNow)).AddDays(4), new TimeOnly(20, 30));

        await Check(accountId, evening);
        (await Notices(accountId)).Should().ContainSingle(n => n.Kind == NoticeKind.Paused)
            .And.NotContain(n => n.Kind == NoticeKind.DailySummary);

        var tomei = new DoseRecordModel(Guid.NewGuid(), medication.Id, DateOnly.FromDateTime(Local(evening)), medication.Times[0], evening.AddHours(-1), evening.AddHours(-1));
        (await phone.PostAsJsonAsync("/api/v1/sync", new SyncModel { DoseRecords = [tomei] }, CmiApiFactory.Json))
            .EnsureSuccessStatusCode();

        await Check(accountId, evening);
        (await Notices(accountId)).Should().ContainSingle(n => n.Kind == NoticeKind.Paused)
            .And.ContainSingle(n => n.Kind == NoticeKind.DailySummary);
    }

    [Fact]
    public async Task The_summary_goes_once_from_20h_local()
    {
        var accountId = await Person(new SyncModel { Medications = [Medication(new TimeOnly(8, 0))] });
        var today = DateOnly.FromDateTime(Local(DateTime.UtcNow));

        await Check(accountId, LocalToUtc(today, new TimeOnly(19, 55)));
        (await Notices(accountId)).Should().NotContain(n => n.Kind == NoticeKind.DailySummary);

        await Check(accountId, LocalToUtc(today, new TimeOnly(20, 5)));
        await Check(accountId, LocalToUtc(today, new TimeOnly(23, 0)));
        (await Notices(accountId)).Should().ContainSingle(n => n.Kind == NoticeKind.DailySummary).Which.Day.Should().Be(today);
    }

    [Fact]
    public async Task The_contact_is_reminded_of_the_birthday_in_the_morning()
    {
        var today = DateOnly.FromDateTime(Local(DateTime.UtcNow));
        var profile = new ProfileModel(new DateOnly(1952, today.Month, today.Day), [], null, null, null, null, DateTimeOffset.UtcNow);
        var accountId = await Person(new SyncModel { Profile = profile });

        await Check(accountId, LocalToUtc(today, new TimeOnly(8, 55)));
        (await Notices(accountId)).Should().NotContain(n => n.Kind == NoticeKind.Birthday);

        await Check(accountId, LocalToUtc(today, new TimeOnly(9, 5)));
        (await Notices(accountId)).Should().ContainSingle(n => n.Kind == NoticeKind.Birthday);
    }

    private static MedicationModel Medication(params TimeOnly[] times) =>
        new(Guid.NewGuid(), "Losartana", "50 mg", times, false, true, false, LongAgo);

    private static DateTime Local(DateTime utc) => TimeZoneInfo.ConvertTimeFromUtc(utc, SaoPaulo);

    private static DateTime LocalToUtc(DateOnly date, TimeOnly time) => TimeZoneInfo.ConvertTimeToUtc(date.ToDateTime(time), SaoPaulo);

    // Now, moved past 02:00 local when needed, so doses a little over an hour ago are on today's date and the setup's
    // contact (the real clock) still counts as recent for them.
    private static DateTime DaytimeNow()
    {
        var now = DateTime.UtcNow;
        return Local(now).Hour < 2 ? now.AddHours(2) : now;
    }

    private static (DateOnly Date, TimeOnly Time) LocalMinutesAgo(DateTime utc, int minutes)
    {
        var local = Local(utc).AddMinutes(-minutes);
        return (DateOnly.FromDateTime(local), new TimeOnly(local.Hour, local.Minute));
    }

    private async Task<Guid> Person(SyncModel records, string? pushToken = null, DevicePlatform platform = DevicePlatform.Android) =>
        (await PersonWithPhone(records, pushToken, platform)).AccountId;

    // A signed-in person in São Paulo with a heartbeat, a trusted contact and the given records.
    private async Task<(Guid AccountId, HttpClient Phone)> PersonWithPhone(SyncModel records, string? pushToken = null, DevicePlatform platform = DevicePlatform.Android)
    {
        var subject = CmiApiFactory.NewSubject();
        var phone = await _factory.SignedInClient(subject, Guid.NewGuid());

        (await phone.PostAsJsonAsync("/api/v1/sync/heartbeat", new HeartbeatModel(platform, "America/Sao_Paulo", pushToken), CmiApiFactory.Json))
            .EnsureSuccessStatusCode();
        var contact = new ContactModel(Guid.NewGuid(), "Ana", "+5511999990000", Relationship.Mother, false, LongAgo);
        (await phone.PostAsJsonAsync("/api/v1/sync", records with { Contacts = [contact] }, CmiApiFactory.Json))
            .EnsureSuccessStatusCode();

        return ((await _factory.StoredAccount(subject)).Id, phone);
    }

    private async Task Check(Guid accountId, DateTime now)
    {
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<NoticeService>().Check(accountId, now);
    }

    private async Task ProcessOutbox()
    {
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<OutboxProcessor>().ProcessPendingAsync(batchSize: 1000);
    }

    private async Task<List<Notice>> Notices(Guid accountId)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<CmiDbContext>().Set<Notice>()
            .AsNoTracking()
            .Where(n => n.AccountId == accountId)
            .ToListAsync();
    }

    private async Task<Account> Account(Guid accountId)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<CmiDbContext>().Accounts.AsNoTracking().SingleAsync(a => a.Id == accountId);
    }
}
