using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
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
        var person = await Person(new SyncModel { Medications = [Medication(time), Medication(time) with { Name = "Metformina", Dose = null }] });

        await Check(person.AccountId, now);
        await Check(person.AccountId, now.AddMinutes(1));

        var notice = (await Notices(person.AccountId)).Should().ContainSingle(n => n.Kind == NoticeKind.MissedDose).Subject;
        notice.Day.Should().Be(date);
        notice.ScheduledTime.Should().Be(time);

        await ProcessOutbox();
        await ProcessOutbox();

        Templates(person).Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Template = "dose_sem_confirmacao",
            Parameters = new[] { "da sua mãe", $"{time:HH:mm}", "Losartana 50 mg, Metformina" },
        });
        (await Notices(person.AccountId)).Single(n => n.Id == notice.Id).SentAt.Should().NotBeNull();
    }

    [Fact]
    public async Task A_taken_dose_or_an_unshared_medication_sends_nothing()
    {
        var now = DaytimeNow();
        var (date, time) = LocalMinutesAgo(now, 65);
        var taken = Medication(time);
        var person = await Person(new SyncModel
        {
            Medications = [taken, Medication(time) with { SharedWithContact = false }],
            DoseRecords = [new DoseRecordModel(Guid.NewGuid(), taken.Id, date, time, DateTimeOffset.UtcNow, DateTimeOffset.UtcNow)],
        });

        await Check(person.AccountId, now);

        (await Notices(person.AccountId)).Should().NotContain(n => n.Kind == NoticeKind.MissedDose);
    }

    [Fact]
    public async Task Without_recent_contact_a_missed_dose_waits_for_the_summary()
    {
        var later = DaytimeNow().AddHours(7);
        var (_, time) = LocalMinutesAgo(later, 65);
        var person = await Person(new SyncModel { Medications = [Medication(time)] });

        await Check(person.AccountId, later);

        (await Notices(person.AccountId)).Should().NotContain(n => n.Kind == NoticeKind.MissedDose);
    }

    [Fact]
    public async Task Doses_at_the_same_time_are_one_notice_and_a_day_has_at_most_three()
    {
        var now = DaytimeNow();
        var times = new[] { 80, 75, 70, 65 }.Select(minutes => LocalMinutesAgo(now, minutes).Time).ToList();
        var person = await Person(new SyncModel { Medications = [Medication([.. times]), Medication(times[0])] });

        await Check(person.AccountId, now);

        (await Notices(person.AccountId)).Where(n => n.Kind == NoticeKind.MissedDose).Select(n => n.ScheduledTime)
            .Should().BeEquivalentTo(times.Take(3));
    }

    [Fact]
    public async Task A_silent_phone_is_pinged_first_and_the_family_told_once()
    {
        var pushToken = CmiApiFactory.NewPushToken();
        var person = await Person(new SyncModel(), pushToken);
        var silent = DateTime.UtcNow.AddHours(12).AddMinutes(1);

        await Check(person.AccountId, silent);
        await ProcessOutbox();
        (await Notices(person.AccountId)).Should().NotContain(n => n.Kind == NoticeKind.NoContact);
        (await Account(person.AccountId)).PingSentAt.Should().BeCloseTo(silent, TimeSpan.FromMilliseconds(1));
        _factory.ExpoPush.SentTo(pushToken).Should().ContainSingle().Which.Should().Be(new SentPush(pushToken, "ping", Silent: true));

        await Check(person.AccountId, silent.AddMinutes(31));
        await Check(person.AccountId, silent.AddHours(5));
        (await Notices(person.AccountId)).Should().ContainSingle(n => n.Kind == NoticeKind.NoContact);

        await ProcessOutbox();
        Templates(person).Should().ContainSingle().Which.Parameters.Should().Equal("da sua mãe", "12");
    }

    [Fact]
    public async Task When_the_receipt_says_the_push_no_longer_reaches_the_app_the_family_is_told_that_once()
    {
        var pushToken = CmiApiFactory.NewPushToken();
        _factory.ExpoPush.Unregister(pushToken, onSend: false);
        var person = await Person(new SyncModel(), pushToken);
        var silent = DateTime.UtcNow.AddHours(12).AddMinutes(1);

        await Check(person.AccountId, silent);
        await ProcessOutbox();
        await Check(person.AccountId, silent.AddMinutes(31));
        await Check(person.AccountId, silent.AddHours(5));

        (await Notices(person.AccountId)).Should().ContainSingle(n => n.Kind == NoticeKind.Uninstalled)
            .And.NotContain(n => n.Kind == NoticeKind.NoContact);
        (await Account(person.AccountId)).PushToken.Should().BeNull();

        await ProcessOutbox();
        Templates(person).Should().ContainSingle().Which.Should().BeEquivalentTo(new { Template = "app_desinstalado", Parameters = new[] { "da sua mãe" } });
    }

    [Fact]
    public async Task A_token_expo_already_knows_is_gone_is_found_out_when_the_ping_is_sent()
    {
        var pushToken = CmiApiFactory.NewPushToken();
        _factory.ExpoPush.Unregister(pushToken, onSend: true);
        var person = await Person(new SyncModel(), pushToken);
        var silent = DateTime.UtcNow.AddHours(12).AddMinutes(1);

        await Check(person.AccountId, silent);
        await ProcessOutbox();
        (await Account(person.AccountId)).Should().BeEquivalentTo(new { PushToken = (string?)null, PingTicketId = (string?)null });

        await Check(person.AccountId, silent.AddMinutes(31));
        (await Notices(person.AccountId)).Should().ContainSingle(n => n.Kind == NoticeKind.Uninstalled);
    }

    [Fact]
    public async Task An_iphone_gets_a_day_before_it_counts_as_silent()
    {
        var person = await Person(new SyncModel(), CmiApiFactory.NewPushToken(), DevicePlatform.Ios);

        await Check(person.AccountId, DateTime.UtcNow.AddHours(13));

        (await Account(person.AccountId)).PingSentAt.Should().BeNull();
    }

    [Fact]
    public async Task Days_without_a_dose_pause_the_notices_until_the_next_tomei()
    {
        var medication = Medication(new TimeOnly(8, 0));
        var person = await Person(new SyncModel { Medications = [medication] });
        var evening = LocalToUtc(DateOnly.FromDateTime(Local(DateTime.UtcNow)).AddDays(4), new TimeOnly(20, 30));

        await Check(person.AccountId, evening);
        (await Notices(person.AccountId)).Should().ContainSingle(n => n.Kind == NoticeKind.Paused)
            .And.NotContain(n => n.Kind == NoticeKind.DailySummary);

        var tomei = new DoseRecordModel(Guid.NewGuid(), medication.Id, DateOnly.FromDateTime(Local(evening)), medication.Times[0], evening.AddHours(-1), evening.AddHours(-1));
        (await person.Phone.PostAsJsonAsync("/api/v1/sync", new SyncModel { DoseRecords = [tomei] }, CmiApiFactory.Json))
            .EnsureSuccessStatusCode();

        await Check(person.AccountId, evening);
        (await Notices(person.AccountId)).Should().ContainSingle(n => n.Kind == NoticeKind.Paused)
            .And.ContainSingle(n => n.Kind == NoticeKind.DailySummary);
    }

    [Fact]
    public async Task The_summary_goes_once_from_20h_local()
    {
        var person = await Person(new SyncModel { Medications = [Medication(new TimeOnly(8, 0))] });
        var today = DateOnly.FromDateTime(Local(DateTime.UtcNow));

        await Check(person.AccountId, LocalToUtc(today, new TimeOnly(19, 55)));
        (await Notices(person.AccountId)).Should().NotContain(n => n.Kind == NoticeKind.DailySummary);

        await Check(person.AccountId, LocalToUtc(today, new TimeOnly(20, 5)));
        await Check(person.AccountId, LocalToUtc(today, new TimeOnly(23, 0)));
        (await Notices(person.AccountId)).Should().ContainSingle(n => n.Kind == NoticeKind.DailySummary).Which.Day.Should().Be(today);
    }

    [Fact]
    public async Task The_summary_counts_the_doses_recorded_unconfirmed_and_still_due()
    {
        // A day whose 20:00 is less than the no-contact limit after the setup's contact.
        var today = DateOnly.FromDateTime(Local(DateTime.UtcNow));
        var day = Local(DateTime.UtcNow).Hour < 9 ? today.AddDays(-1) : today;
        var medication = Medication(new TimeOnly(8, 0), new TimeOnly(12, 0), new TimeOnly(19, 30));
        var tomei = new DoseRecordModel(Guid.NewGuid(), medication.Id, day, new TimeOnly(8, 0), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);
        var person = await Person(new SyncModel { Medications = [medication, Medication(new TimeOnly(8, 0)) with { Paused = true }], DoseRecords = [tomei] });

        await Check(person.AccountId, LocalToUtc(day, new TimeOnly(20, 5)));
        await ProcessOutbox();

        Templates(person).Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Template = "resumo_diario",
            Parameters = new[] { "da sua mãe", "1", "1", "1" },
        });
    }

    [Fact]
    public async Task The_summary_reads_each_dose_with_the_schedule_it_had()
    {
        // A day whose 20:00 is less than the no-contact limit after the setup's contact.
        var today = DateOnly.FromDateTime(Local(DateTime.UtcNow));
        var day = Local(DateTime.UtcNow).Hour < 9 ? today.AddDays(-1) : today;

        // Moved from 08:00 to 18:00 at noon, then edited at 19:00 (an edit used to drop the day's earlier doses).
        var moved = Medication(new TimeOnly(18, 0)) with { UpdatedAt = LocalToUtc(day, new TimeOnly(19, 0)) };
        var morning = new MedicationPeriodModel(Guid.NewGuid(), moved.Id, LongAgo, [new TimeOnly(8, 0)], false, LongAgo);
        var evening = new MedicationPeriodModel(Guid.NewGuid(), moved.Id, LocalToUtc(day, new TimeOnly(12, 0)), [new TimeOnly(18, 0)], false, LongAgo);
        var tomei = new DoseRecordModel(Guid.NewGuid(), moved.Id, day, new TimeOnly(8, 0), DateTimeOffset.UtcNow, DateTimeOffset.UtcNow);

        // Paused at 10:00: its 08:00 dose still counts, its 12:00 one doesn't.
        var paused = Medication(new TimeOnly(8, 0), new TimeOnly(12, 0)) with { Paused = true };
        var beforePause = new MedicationPeriodModel(Guid.NewGuid(), paused.Id, LongAgo, paused.Times, false, LongAgo);
        var pause = new MedicationPeriodModel(Guid.NewGuid(), paused.Id, LocalToUtc(day, new TimeOnly(10, 0)), paused.Times, true, LongAgo);

        var person = await Person(new SyncModel
        {
            Medications = [moved, paused],
            MedicationPeriods = [morning, evening, beforePause, pause],
            DoseRecords = [tomei],
        });

        await Check(person.AccountId, LocalToUtc(day, new TimeOnly(20, 5)));
        await ProcessOutbox();

        Templates(person).Should().ContainSingle().Which.Should().BeEquivalentTo(new
        {
            Template = "resumo_diario",
            Parameters = new[] { "da sua mãe", "1", "2", "0" },
        });
    }

    [Fact]
    public async Task While_the_phone_is_silent_the_summary_says_there_is_no_data()
    {
        var person = await Person(new SyncModel { Medications = [Medication(new TimeOnly(8, 0))] });
        var later = DateOnly.FromDateTime(Local(DateTime.UtcNow)).AddDays(2);

        await Check(person.AccountId, LocalToUtc(later, new TimeOnly(20, 5)));
        await ProcessOutbox();

        Templates(person).Should().ContainSingle(m => m.Template == "resumo_sem_dados")
            .Which.Parameters.Should().Equal("da sua mãe");
    }

    [Fact]
    public async Task The_contact_is_reminded_of_the_birthday_in_the_morning()
    {
        var today = DateOnly.FromDateTime(Local(DateTime.UtcNow));
        var profile = new ProfileModel("Maria", new DateOnly(1952, today.Month, today.Day), [], null, null, null, null, DateTimeOffset.UtcNow);
        var person = await Person(new SyncModel { Profile = profile });

        await Check(person.AccountId, LocalToUtc(today, new TimeOnly(8, 55)));
        (await Notices(person.AccountId)).Should().NotContain(n => n.Kind == NoticeKind.Birthday);

        await Check(person.AccountId, LocalToUtc(today, new TimeOnly(9, 5)));
        (await Notices(person.AccountId)).Should().ContainSingle(n => n.Kind == NoticeKind.Birthday);

        await ProcessOutbox();
        Templates(person).Should().ContainSingle(m => m.Template == "aniversario")
            .Which.Parameters.Should().Equal("da sua mãe, Maria");
    }

    [Fact]
    public async Task A_contact_who_never_linked_up_or_answered_parar_gets_nothing()
    {
        var now = DaytimeNow();
        var (_, time) = LocalMinutesAgo(now, 65);
        var unlinked = await Person(new SyncModel { Medications = [Medication(time)] }, link: false);
        var stopped = await Person(new SyncModel { Medications = [Medication(time)] });

        // Decided before PARAR, sent after it.
        await Check(stopped.AccountId, now);
        (await _factory.ReceiveWhatsApp(stopped.WhatsApp, "Parar")).EnsureSuccessStatusCode();
        await ProcessOutbox();

        (await AccountsToCheck(now)).Should().NotContain([unlinked.AccountId, stopped.AccountId]);
        Templates(stopped).Should().BeEmpty();
    }

    [Fact]
    public async Task When_premium_ends_nothing_is_sent_and_the_link_waits_for_a_new_subscription()
    {
        var now = DaytimeNow();
        var (_, time) = LocalMinutesAgo(now, 65);
        var person = await Person(new SyncModel { Medications = [Medication(time)] });
        (await AccountsToCheck(now)).Should().Contain(person.AccountId);

        // Decided while Premium, sent after it ended.
        await Check(person.AccountId, now);
        await _factory.SetPremium(person.AccountId, DateTimeOffset.UtcNow.AddMinutes(-1), "EXPIRATION");
        await ProcessOutbox();

        Templates(person).Should().BeEmpty();
        (await AccountsToCheck(now)).Should().NotContain(person.AccountId);

        await _factory.SetPremium(person.AccountId, DateTimeOffset.UtcNow.AddMonths(1), "RENEWAL");
        (await AccountsToCheck(now)).Should().Contain(person.AccountId);
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

    private List<SentMessage> Templates(PersonSetup person) =>
        _factory.WhatsApp.SentTo(person.WhatsApp).Where(m => m.Template is not null).ToList();

    // A signed-in Premium person in São Paulo with a heartbeat, the given records and their mother as the trusted
    // contact, linked up on WhatsApp unless told otherwise.
    private async Task<PersonSetup> Person(SyncModel records, string? pushToken = null, DevicePlatform platform = DevicePlatform.Android, bool link = true)
    {
        var subject = CmiApiFactory.NewSubject();
        var phone = await _factory.SignedInClient(subject, Guid.NewGuid());

        (await phone.PostAsJsonAsync("/api/v1/sync/heartbeat", new HeartbeatModel(platform, "America/Sao_Paulo", pushToken), CmiApiFactory.Json))
            .EnsureSuccessStatusCode();
        var contact = new ContactModel(Guid.NewGuid(), "Ana", "+5511999990000", Relationship.Mother, false, LongAgo);

        // The app starts a period with each medication; a test about the schedule's history sends its own.
        var periods = records.MedicationPeriods.Count > 0
            ? records.MedicationPeriods
            : records.Medications.Select(m => new MedicationPeriodModel(Guid.NewGuid(), m.Id, LongAgo, m.Times, m.Paused, LongAgo)).ToList();
        (await phone.PostAsJsonAsync("/api/v1/sync", records with { Contacts = [contact], MedicationPeriods = periods }, CmiApiFactory.Json))
            .EnsureSuccessStatusCode();

        var whatsApp = CmiApiFactory.NewWhatsAppNumber();
        if (link)
        {
            var code = (await phone.GetFromJsonAsync<ContactLinkModel>("/api/v1/contact/link", CmiApiFactory.Json))!.Code;
            (await _factory.ReceiveWhatsApp(whatsApp, $"Quero receber os avisos. Código: {code}")).EnsureSuccessStatusCode();
        }

        var accountId = (await _factory.StoredAccount(subject)).Id;
        await _factory.SetPremium(accountId, DateTimeOffset.UtcNow.AddYears(1));

        return new PersonSetup(accountId, phone, whatsApp);
    }

    private async Task<IReadOnlyList<Guid>> AccountsToCheck(DateTime now)
    {
        using var scope = _factory.Services.CreateScope();
        return await scope.ServiceProvider.GetRequiredService<NoticeService>().AccountsToCheck(now);
    }

    private async Task Check(Guid accountId, DateTime now)
    {
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<NoticeService>().Check(accountId, now);
    }

    private Task ProcessOutbox() => _factory.ProcessOutbox();

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

    private sealed record PersonSetup(Guid AccountId, HttpClient Phone, string WhatsApp);
}
