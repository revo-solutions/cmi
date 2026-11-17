using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Models;
using Riok.Mapperly.Abstractions;

namespace RevoSolutions.CMI.Domain.Mapping;

[Mapper(RequiredMappingStrategy = RequiredMappingStrategy.Target)]
public partial class SyncMapper
{
    public partial MedicationModel ToModel(Medication entity);

    public partial MedicationPeriodModel ToModel(MedicationPeriod entity);

    public partial DoseRecordModel ToModel(DoseRecord entity);

    [MapValue(nameof(ContactModel.Deleted), false)]
    public partial ContactModel ToModel(Contact entity);

    public static ProfileModel? ToProfile(Account account) => account.ProfileUpdatedAt is { } updatedAt
        ? new ProfileModel(
            account.Name,
            account.BirthDate,
            account.Conditions,
            account.OtherCondition,
            account.LivesAlone,
            account.FellLastYear,
            account.VisionDifficulty,
            updatedAt)
        : null;
}
