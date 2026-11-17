using FluentValidation;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class DoseRecordModelValidator : AbstractValidator<DoseRecordModel>
{
    public DoseRecordModelValidator()
    {
        RuleFor(record => record.Id).NotEmpty();
        RuleFor(record => record.MedicationId).NotEmpty();
        RuleFor(record => record.ScheduledDate).NotEmpty();
        RuleFor(record => record.UpdatedAt).NotEmpty();
    }
}
