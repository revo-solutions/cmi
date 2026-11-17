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
        Deleted = model.Deleted;
        UpdatedAt = model.UpdatedAt.UtcDateTime;
    }
}
