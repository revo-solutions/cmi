using FluentValidation;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class SyncModelValidator : AbstractValidator<SyncModel>
{
    // The outgoing queue sends in batches; a bigger one is a bug on the device.
    private const int MaxRecordsPerList = 500;

    public SyncModelValidator()
    {
        RuleFor(sync => sync.Profile!).SetValidator(new ProfileModelValidator()).When(sync => sync.Profile is not null);

        RuleFor(sync => sync.Medications).NotNull().Must(list => list.Count <= MaxRecordsPerList);
        RuleForEach(sync => sync.Medications).SetValidator(new MedicationModelValidator());

        RuleFor(sync => sync.DoseRecords).NotNull().Must(list => list.Count <= MaxRecordsPerList);
        RuleForEach(sync => sync.DoseRecords).SetValidator(new DoseRecordModelValidator());

        RuleFor(sync => sync.Contacts).NotNull().Must(list => list.Count <= MaxRecordsPerList);
        RuleForEach(sync => sync.Contacts).SetValidator(new ContactModelValidator());
    }
}
