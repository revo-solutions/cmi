using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Services;

// The time-based notice rules (docs/escopo.md), checked every minute for each account. Every notice gets a unique key,
// so a check that runs twice, or one cut off half way, never decides the same notice again.
public class NoticeService
{
    // A missed dose found later than this after its deadline (the worker was down, or the contact was just added) is
    // left to the daily summary rather than sent late.
    private static readonly TimeSpan MissedDoseCatchUp = TimeSpan.FromHours(1);

    private readonly IRepository<Account> _accounts;
    private readonly IRepository<Contact> _contacts;
    private readonly IRepository<Medication> _medications;
    private readonly IRepository<DoseRecord> _doseRecords;
    private readonly IRepository<Notice> _notices;
    private readonly IUnitOfWork _unitOfWork;
    private readonly NoticeSettings _settings;

    public NoticeService(
        IRepository<Account> accounts,
        IRepository<Contact> contacts,
        IRepository<Medication> medications,
        IRepository<DoseRecord> doseRecords,
        IRepository<Notice> notices,
        IUnitOfWork unitOfWork,
        NoticeSettings settings)
    {
        _accounts = accounts;
        _contacts = contacts;
        _medications = medications;
        _doseRecords = doseRecords;
        _notices = notices;
        _unitOfWork = unitOfWork;
        _settings = settings;
    }

    // Only accounts with a trusted contact get notices. The WhatsApp link and Premium narrow this further once they exist.
    public async Task<IReadOnlyList<Guid>> AccountsToCheck() =>
        (await _contacts.Get(_ => true)).Select(c => c.AccountId).Distinct().ToList();

    public async Task Check(Guid accountId, DateTime now)
    {
        var account = await _accounts.FirstOrDefault(a => a.Id == accountId);

        // Without a heartbeat there is no time zone to read the schedule in.
        if (account?.TimeZone is null || account.LastSeenAt is null)
        {
            return;
        }

        var timeZone = TimeZoneInfo.FindSystemTimeZoneById(account.TimeZone);
        var localNow = TimeZoneInfo.ConvertTimeFromUtc(now, timeZone);
        var today = DateOnly.FromDateTime(localNow);

        await CheckContact(account, now, today);

        var medications = await _medications.Get(m => m.AccountId == account.Id && m.SharedWithContact && !m.Paused && !m.Deleted);
        if (medications.Count > 0)
        {
            // No "Tomei" for days pauses the missed-dose notices and the summary until the next one.
            var lastTaken = account.LastTakenAt ?? account.CreatedDate;
            if (now - lastTaken >= TimeSpan.FromDays(_settings.AbandonmentDays))
            {
                await Notify(account, NoticeKind.Paused, $"{lastTaken:O}", today);
            }
            else
            {
                await CheckMissedDoses(account, medications, timeZone, now, today);

                if (TimeOnly.FromDateTime(localNow) >= _settings.SummaryTime)
                {
                    await Notify(account, NoticeKind.DailySummary, $"{today:O}", today);
                }
            }
        }

        if (account.BirthDate is { } birthDate && IsBirthday(birthDate, today) && TimeOnly.FromDateTime(localNow) >= _settings.BirthdayTime)
        {
            await Notify(account, NoticeKind.Birthday, $"{today.Year}", today);
        }

        await _unitOfWork.CommitAsync();
    }

    // Silent past the limit: ping first, and tell the family once if the ping brings no heartbeat. The key is the last
    // contact, so the notice repeats only after the phone has been back in touch.
    private async Task CheckContact(Account account, DateTime now, DateOnly today)
    {
        var lastSeen = account.LastSeenAt!.Value;
        var limit = account.Platform == DevicePlatform.Ios ? _settings.NoContactIos : _settings.NoContactAndroid;
        if (now - lastSeen < limit)
        {
            return;
        }

        var pinged = account.PingSentAt > lastSeen;
        if (!pinged && account.PushToken is not null)
        {
            account.RequestPing(now);
            return;
        }

        if (pinged && now - account.PingSentAt < _settings.PingWait)
        {
            return;
        }

        await Notify(account, NoticeKind.NoContact, $"{lastSeen:O}", today);
    }

    // A dose is unconfirmed once its deadline passes with no "Tomei". The family hears only if the phone was in touch
    // shortly before the deadline (otherwise the dose waits for the summary), at most a few times a day, and once for
    // every dose due at the same time.
    private async Task CheckMissedDoses(Account account, IReadOnlyList<Medication> medications, TimeZoneInfo timeZone, DateTime now, DateOnly today)
    {
        var yesterday = today.AddDays(-1);
        var taken = (await _doseRecords.Get(d => d.AccountId == account.Id && d.ScheduledDate >= yesterday && d.TakenAt != null))
            .Select(d => (d.MedicationId, d.ScheduledDate, d.ScheduledTime))
            .ToHashSet();

        var missed = new[] { yesterday, today }
            .SelectMany(date => medications.SelectMany(medication => medication.Times.Select(time => (date, time, medication))))
            .Select(dose => (dose.date, dose.time, dose.medication, scheduledAt: ToUtc(dose.date, dose.time, timeZone)))
            .Where(dose => dose.scheduledAt is { } scheduledAt
                // A dose scheduled before the medication's last change (added, edited, resumed) got no reminder.
                && scheduledAt >= dose.medication.UpdatedAt
                && scheduledAt + _settings.MissedDoseAfter <= now
                && scheduledAt + _settings.MissedDoseAfter > now - MissedDoseCatchUp
                && account.LastSeenAt >= scheduledAt + _settings.MissedDoseAfter - _settings.RecentContact
                && !taken.Contains((dose.medication.Id, dose.date, dose.time)))
            .Select(dose => (dose.date, dose.time))
            .Distinct()
            .OrderBy(dose => dose.date)
            .ThenBy(dose => dose.time);

        var decided = new Dictionary<DateOnly, int>();
        foreach (var (date, time) in missed)
        {
            if (!decided.TryGetValue(date, out var count))
            {
                count = (await _notices.Get(n => n.AccountId == account.Id && n.Kind == NoticeKind.MissedDose && n.Day == date)).Count;
            }

            if (count < _settings.MissedDoseNoticesPerDay && await Notify(account, NoticeKind.MissedDose, $"{date:O}T{time:O}", date, time))
            {
                count++;
            }

            decided[date] = count;
        }
    }

    private async Task<bool> Notify(Account account, NoticeKind kind, string discriminator, DateOnly day, TimeOnly? scheduledTime = null)
    {
        var key = $"{account.Id}:{kind}:{discriminator}";
        if (await _notices.FirstOrDefault(n => n.Key == key) is not null)
        {
            return false;
        }

        await _notices.Add(Notice.Create(account.Id, kind, key, day, scheduledTime));
        return true;
    }

    // A wall-clock time skipped by a daylight-saving change never happened.
    private static DateTime? ToUtc(DateOnly date, TimeOnly time, TimeZoneInfo timeZone)
    {
        var local = date.ToDateTime(time);
        return timeZone.IsInvalidTime(local) ? null : TimeZoneInfo.ConvertTimeToUtc(local, timeZone);
    }

    // Someone born on 29 February is remembered on the 28th in other years.
    private static bool IsBirthday(DateOnly birthDate, DateOnly today) =>
        (birthDate.Month == today.Month && birthDate.Day == today.Day)
        || (birthDate is { Month: 2, Day: 29 } && today is { Month: 2, Day: 28 } && !DateTime.IsLeapYear(today.Year));
}
