using FluentValidation;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class MedicationModelValidator : AbstractValidator<MedicationModel>
{
    public MedicationModelValidator()
    {
        RuleFor(medication => medication.Id).NotEmpty();
        RuleFor(medication => medication.Name).NotEmpty().MaximumLength(200);
        RuleFor(medication => medication.Dose).MaximumLength(200);
        RuleFor(medication => medication.Times).NotNull().Must(times => times.Count <= 24);
        RuleFor(medication => medication.UpdatedAt).NotEmpty();
    }
}
