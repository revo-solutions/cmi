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
    private readonly IRepository<DoseRecord> _doseRecords;
    private readonly NoticeSettings _settings;

    public NoticeMessageBuilder(IRepository<Account> accounts, IRepository<Medication> medications, IRepository<DoseRecord> doseRecords, NoticeSettings settings)
    {
        _accounts = accounts;
        _medications = medications;
        _doseRecords = doseRecords;
        _settings = settings;
    }

    public static string Subject(Relationship relationship, string? name)
    {
        var relative = relationship switch
        {
            Relationship.Father => "do seu pai",
            Relationship.Mother => "da sua mãe",
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

    // Null when there is nothing left to say, such as a missed dose recorded in the meantime.
    public async Task<NoticeMessage?> Build(Notice notice, Contact contact)
    {
        var account = await _accounts.FirstOrDefault(a => a.Id == notice.AccountId);
        if (account?.TimeZone is null)
        {
            return null;
        }

        var subject = Subject(contact.Relationship, account.Name);
        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(account.TimeZone);

        return notice.Kind switch
        {
            NoticeKind.MissedDose => await MissedDose(notice, subject),
            NoticeKind.DailySummary => await Summary(account, notice.Day, timeZone, subject),
            NoticeKind.NoContact => new(NoticeTemplate.NoContact, [subject, Number(_settings.NoContactLimit(account.Platform).TotalHours)]),
            NoticeKind.Paused => new(NoticeTemplate.Paused, [subject, Number(_settings.AbandonmentDays)]),
            NoticeKind.Birthday => new(NoticeTemplate.Birthday, [subject]),
            _ => throw new ArgumentOutOfRangeException(nameof(notice), notice.Kind, "Unknown notice kind."),
        };
    }

    private async Task<NoticeMessage?> MissedDose(Notice notice, string subject)
    {
        var time = notice.ScheduledTime!.Value;
        var taken = (await _doseRecords.Get(d => d.AccountId == notice.AccountId && d.ScheduledDate == notice.Day && d.ScheduledTime == time && d.TakenAt != null))
            .Select(d => d.MedicationId)
            .ToHashSet();
        var medications = (await SharedMedications(notice.AccountId))
            .Where(m => m.Times.Contains(time) && !taken.Contains(m.Id))
            .OrderBy(m => m.Name, StringComparer.CurrentCulture)
            .Select(m => string.IsNullOrWhiteSpace(m.Dose) ? m.Name : $"{m.Name} {m.Dose}")
            .ToList();

        return medications.Count == 0
            ? null
            : new(NoticeTemplate.MissedDose, [subject, time.ToString("HH:mm", CultureInfo.InvariantCulture), string.Join(", ", medications)]);
    }

    // The 24 hours before the summary time. While the phone is silent its doses say nothing, so the summary says that.
    private async Task<NoticeMessage> Summary(Account account, DateOnly day, TimeZoneInfo timeZone, string subject)
    {
        var end = TimeZoneInfo.ConvertTimeToUtc(day.ToDateTime(_settings.SummaryTime), timeZone);
        if (end - account.LastSeenAt >= _settings.NoContactLimit(account.Platform))
        {
            return new(NoticeTemplate.DailySummaryNoData, [subject]);
        }

        var since = day.AddDays(-1);
        var taken = (await _doseRecords.Get(d => d.AccountId == account.Id && d.ScheduledDate >= since && d.TakenAt != null))
            .Select(d => (d.MedicationId, d.ScheduledDate, d.ScheduledTime))
            .ToHashSet();
        var doses = (await SharedMedications(account.Id))
            .SelectMany(m => m.DosesBetween(end.AddDays(-1), end, timeZone).Select(dose => (Taken: taken.Contains((m.Id, dose.Date, dose.Time)), dose.ScheduledAt)))
            .ToList();

        var recorded = doses.Count(d => d.Taken);
        var unconfirmed = doses.Count(d => !d.Taken && d.ScheduledAt + _settings.MissedDoseAfter <= end);

        return new(NoticeTemplate.DailySummary, [subject, Number(recorded), Number(unconfirmed), Number(doses.Count - recorded - unconfirmed)]);
    }

    private Task<IReadOnlyList<Medication>> SharedMedications(Guid accountId) =>
        _medications.Get(m => m.AccountId == accountId && m.SharedWithContact && !m.Paused && !m.Deleted);

    private static string Number(double value) => value.ToString("0", CultureInfo.InvariantCulture);
}
