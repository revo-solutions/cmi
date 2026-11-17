using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Entities;

public class Medication : SyncedEntityBase
{
    public string Name { get; set; } = string.Empty;

    // Free text: "50 mg, 1 comprimido".
    public string? Dose { get; set; }

    // Wall-clock times in the person's time zone.
    public List<TimeOnly> Times { get; set; } = [];

    public bool Paused { get; set; }

    // Whether the trusted contact hears about this medication; one they never see unless it is set.
    public bool SharedWithContact { get; set; }

    // Kept as a tombstone: the dose history still points at it.
    public bool Deleted { get; set; }

    public static Medication Create(Guid accountId, MedicationModel model)
    {
        var medication = new Medication { Id = model.Id, AccountId = accountId };
        medication.Update(model);

        return medication;
    }

    public void Update(MedicationModel model)
    {
        Name = model.Name;
        Dose = model.Dose;
        Times = model.Times.ToList();
        Paused = model.Paused;
        SharedWithContact = model.SharedWithContact;
        Deleted = model.Deleted;
        UpdatedAt = model.UpdatedAt.UtcDateTime;
    }

    // The doses scheduled in (from, to], with their instants. A dose before the medication's last change (added, edited,
    // resumed) never had a reminder, and a wall-clock time skipped by a daylight-saving change never happened.
    public IEnumerable<(DateOnly Date, TimeOnly Time, DateTime ScheduledAt)> DosesBetween(DateTime from, DateTime to, TimeZoneInfo timeZone)
    {
        var last = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(to, timeZone));
        for (var date = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(from, timeZone)); date <= last; date = date.AddDays(1))
        {
            foreach (var time in Times)
            {
                var local = date.ToDateTime(time);
                if (timeZone.IsInvalidTime(local))
                {
                    continue;
                }

                var scheduledAt = TimeZoneInfo.ConvertTimeToUtc(local, timeZone);
                if (scheduledAt > from && scheduledAt <= to && scheduledAt >= UpdatedAt)
                {
                    yield return (date, time, scheduledAt);
                }
            }
        }
    }
}
