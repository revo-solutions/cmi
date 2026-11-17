namespace RevoSolutions.CMI.Domain.Models;

// Both directions: the device uploads the records it changed, and downloads every record of the account.
public record SyncModel
{
    public ProfileModel? Profile { get; init; }

    public IReadOnlyList<MedicationModel> Medications { get; init; } = [];

    public IReadOnlyList<MedicationPeriodModel> MedicationPeriods { get; init; } = [];

    public IReadOnlyList<DoseRecordModel> DoseRecords { get; init; } = [];

    public IReadOnlyList<ContactModel> Contacts { get; init; } = [];
}
