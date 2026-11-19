using System.Globalization;
using RevoSolutions.CMI.Domain.Contracts.Messaging;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Services;

// What a decided notice says, built when it is sent so it reflects the current data. The person is always the first
// value, in the "of" form the templates expect: "da sua mãe, Maria".
public class NoticeMessageBuilder
{
    private readonly IRepository<Account> _accounts;
    private readonly IRepository<Medication> _medications;
    private readonly IRepository<MedicationPeriod> _periods;
    private readonly IRepository<DoseRecord> _doseRecords;
    private readonly NoticeSettings _settings;

    public NoticeMessageBuilder(
        IRepository<Account> accounts,
        IRepository<Medication> medications,
        IRepository<MedicationPeriod> periods,
        IRepository<DoseRecord> doseRecords,
        NoticeSettings settings)
    {
        _accounts = accounts;
        _medications = medications;
        _periods = periods;
        _doseRecords = doseRecords;
        _settings = settings;
    }

    public static string Subject(Relationship relationship, string? name)
    {
        var relative = relationship switch
        {
            Relationship.Father => "do seu pai",
            Relationship.Mother => "da sua mãe",
            Relationship.Husband => "do seu marido",
            Relationship.Wife => "da sua esposa",
            Relationship.Grandfather => "do seu avô",
            Relationship.Grandmother => "da sua avó",
            Relationship.Uncle => "do seu tio",
            Relationship.Aunt => "da sua tia",
            _ => null,
        };

        return (relative, string.IsNullOrWhiteSpace(name) ? null : name.Trim()) switch
        {
            ({ } r, { } n) => $"{r}, {n}",
            ({ } r, null) => r,
            (null, { } n) => $"de {n}",
            _ => "da pessoa que você acompanha",
        };
    }

    // Google's Maps URL, since the contact's phone is unknown: it opens Google Maps on Android, and Google Maps or the
    // browser on an iPhone. The app's SMS carries the same link.
    public static string MapLink(Notice notice) => notice is { Latitude: { } latitude, Longitude: { } longitude }
        ? string.Create(CultureInfo.InvariantCulture, $"https://www.google.com/maps/search/?api=1&query={latitude:F6},{longitude:F6}")
        : "não disponível";

    // Null when there is nothing left to say, such as a missed dose recorded in the meantime.
    public async Task<NoticeMessage?> Build(Notice notice, Contact contact)
    {
        var account = await _accounts.FirstOrDefault(a => a.Id == notice.AccountId);
        if (account is null)
        {
            return null;
        }

        var subject = Subject(contact.Relationship, account.Name);

        return notice.Kind switch
        {
            NoticeKind.MissedDose => await MissedDose(account, notice, subject),
            NoticeKind.DailySummary => await Summary(account, notice.Day, subject),
            NoticeKind.Sos => new(NoticeTemplate.Sos, [subject, string.Create(CultureInfo.InvariantCulture, $"{notice.Day:dd/MM} às {notice.ScheduledTime:HH:mm}"), MapLink(notice)]),
            NoticeKind.NoContact => new(NoticeTemplate.NoContact, [subject, Number(_settings.NoContactLimit(account.Platform).TotalHours)]),
            NoticeKind.Uninstalled => new(NoticeTemplate.Uninstalled, [subject]),
            NoticeKind.Paused => new(NoticeTemplate.Paused, [subject, Number(_settings.AbandonmentDays)]),
            NoticeKind.Birthday => new(NoticeTemplate.Birthday, [subject]),
            _ => throw new ArgumentOutOfRangeException(nameof(notice), notice.Kind, "Unknown notice kind."),
        };
    }

    // The medications due at that time on that day by the schedule they had then. The rules decide a missed dose only
    // for an account with a time zone.
    private async Task<NoticeMessage?> MissedDose(Account account, Notice notice, string subject)
    {
        var time = notice.ScheduledTime!.Value;
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(account.TimeZone!);
        var scheduledAt = TimeZoneInfo.ConvertTimeToUtc(notice.Day.ToDateTime(time), timeZone);
        var taken = (await _doseRecords.Get(d => d.AccountId == notice.AccountId && d.ScheduledDate == notice.Day && d.ScheduledTime == time && d.TakenAt != null))
            .Select(d => d.MedicationId)
            .ToHashSet();
        var shared = await SharedMedications(notice.AccountId);
        var due = (await Doses(shared, scheduledAt.AddTicks(-1), scheduledAt, timeZone)).Select(dose => dose.MedicationId).ToHashSet();
        var medications = shared
            .Where(m => due.Contains(m.Id) && !taken.Contains(m.Id))
            .OrderBy(m => m.Name, StringComparer.CurrentCulture)
            .Select(m => string.IsNullOrWhiteSpace(m.Dose) ? m.Name : $"{m.Name} {m.Dose}")
            .ToList();

        return medications.Count == 0
            ? null
            : new(NoticeTemplate.MissedDose, [subject, time.ToString("HH:mm", CultureInfo.InvariantCulture), string.Join(", ", medications)]);
    }

    // The 24 hours before the summary time. While the phone is silent its doses say nothing, so the summary says that.
    // The rules decide a summary only for an account with a time zone.
    private async Task<NoticeMessage> Summary(Account account, DateOnly day, string subject)
    {
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(account.TimeZone!);
        var end = TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(_settings.SummaryTime), timeZone);
        if (end - account.LastSeenAt >= _settings.NoContactLimit(account.Platform))
        {
            return new(NoticeTemplate.DailySummaryNoData, [subject]);
        }

        var since = day.AddDays(-1);
        var taken = (await _doseRecords.Get(d => d.AccountId == account.Id && d.ScheduledDate >= since && d.TakenAt != null))
            .Select(d => (d.MedicationId, d.ScheduledDate, d.ScheduledTime))
            .ToHashSet();
        var doses = (await Doses(await SharedMedications(account.Id), end.AddDays(-1), end, timeZone))
            .Select(dose => (Taken: taken.Contains((dose.MedicationId, dose.Date, dose.Time)), dose.ScheduledAt))
            .ToList();

        var recorded = doses.Count(d => d.Taken);
        var unconfirmed = doses.Count(d => !d.Taken && d.ScheduledAt + _settings.MissedDoseAfter <= end);

        return new(NoticeTemplate.DailySummary, [subject, Number(recorded), Number(unconfirmed), Number(doses.Count - recorded - unconfirmed)]);
    }

    // A medication paused today still counts the doses it had before the pause; its periods say when.
    private Task<IReadOnlyList<Medication>> SharedMedications(Guid accountId) =>
        _medications.Get(m => m.AccountId == accountId && m.SharedWithContact && !m.Deleted);

    private async Task<List<(Guid MedicationId, DateOnly Date, TimeOnly Time, DateTime ScheduledAt)>> Doses(
        IReadOnlyList<Medication> medications, DateTime from, DateTime to, TimeZoneInfo timeZone)
    {
        var ids = medications.Select(m => m.Id).ToList();
        var periods = await _periods.Get(p => ids.Contains(p.MedicationId));

        return MedicationPeriod.DosesBetween(periods, from, to, timeZone).ToList();
    }

    private static string Number(double value) => value.ToString("0", CultureInfo.InvariantCulture);
}
