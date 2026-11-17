using FluentValidation;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class MedicationPeriodModelValidator : AbstractValidator<MedicationPeriodModel>
{
    public MedicationPeriodModelValidator()
    {
        RuleFor(period => period.Id).NotEmpty();
        RuleFor(period => period.MedicationId).NotEmpty();
        RuleFor(period => period.StartsAt).NotEmpty();
        RuleFor(period => period.Times).NotNull().Must(times => times.Count <= 24);
        RuleFor(period => period.UpdatedAt).NotEmpty();
    }
}
