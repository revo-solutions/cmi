using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Entities;

// A stretch of a medication's schedule: its times from StartsAt until the medication's next period, none while paused.
// The device starts one when the medication is created, its times change, or it is paused or resumed, so a past day is
// read with the schedule it had, not today's.
public class MedicationPeriod : SyncedEntityBase
{
    public Guid MedicationId { get; set; }

    public DateTime StartsAt { get; set; }

    // Wall-clock times in the person's time zone.
    public List<TimeOnly> Times { get; set; } = [];

    public bool Paused { get; set; }

    public static MedicationPeriod Create(Guid accountId, MedicationPeriodModel model)
    {
        var period = new MedicationPeriod { Id = model.Id, AccountId = accountId, MedicationId = model.MedicationId };
        period.Update(model);

        return period;
    }

    public void Update(MedicationPeriodModel model)
    {
        StartsAt = model.StartsAt.UtcDateTime;
        Times = model.Times.ToList();
        Paused = model.Paused;
        UpdatedAt = model.UpdatedAt.UtcDateTime;
    }

    // The doses the periods schedule in (from, to], with their instants. A wall-clock time skipped by a daylight-saving
    // change never happened.
    public static IEnumerable<(Guid MedicationId, DateOnly Date, TimeOnly Time, DateTime ScheduledAt)> DosesBetween(
        IEnumerable<MedicationPeriod> periods, DateTime from, DateTime to, TimeZoneInfo timeZone)
    {
        var first = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(from, timeZone));
        var last = DateOnly.FromDateTime(TimeZoneInfo.ConvertTimeFromUtc(to, timeZone));

        foreach (var medication in periods.GroupBy(p => p.MedicationId))
        {
            var ordered = medication.OrderBy(p => p.StartsAt).ToList();
            for (var i = 0; i < ordered.Count; i++)
            {
                var period = ordered[i];
                var until = i + 1 < ordered.Count ? ordered[i + 1].StartsAt : DateTime.MaxValue;
                if (period.Paused)
                {
                    continue;
                }

                for (var date = first; date <= last; date = date.AddDays(1))
                {
                    foreach (var time in period.Times)
                    {
                        var local = date.ToDateTime(time);
                        if (timeZone.IsInvalidTime(local))
                        {
                            continue;
                        }

                        var scheduledAt = TimeZoneInfo.ConvertTimeToUtc(local, timeZone);
                        if (scheduledAt > from && scheduledAt <= to && scheduledAt >= period.StartsAt && scheduledAt < until)
                        {
                            yield return (medication.Key, date, time, scheduledAt);
                        }
                    }
                }
            }
        }
    }
}
