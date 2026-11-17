using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Entities;

// One scheduled dose. "Tomei" sets TakenAt; undoing an accidental tap is a later change that clears it.
public class DoseRecord : SyncedEntityBase
{
    public Guid MedicationId { get; set; }

    public DateOnly ScheduledDate { get; set; }

    public TimeOnly ScheduledTime { get; set; }

    public DateTime? TakenAt { get; set; }

    public static DoseRecord Create(Guid accountId, DoseRecordModel model)
    {
        var record = new DoseRecord
        {
            Id = model.Id,
            AccountId = accountId,
            MedicationId = model.MedicationId,
            ScheduledDate = model.ScheduledDate,
            ScheduledTime = model.ScheduledTime,
        };
        record.Update(model);

        return record;
    }

    // Which dose it is never changes; only whether it was taken.
    public void Update(DoseRecordModel model)
    {
        TakenAt = model.TakenAt?.UtcDateTime;
        UpdatedAt = model.UpdatedAt.UtcDateTime;
    }
}
