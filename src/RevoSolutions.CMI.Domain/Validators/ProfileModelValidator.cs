using FluentValidation;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class ProfileModelValidator : AbstractValidator<ProfileModel>
{
    public ProfileModelValidator()
    {
        RuleFor(profile => profile.Name).MaximumLength(100);

        RuleFor(profile => profile.BirthDate)
            .InclusiveBetween(new DateOnly(1900, 1, 1), DateOnly.FromDateTime(DateTime.UtcNow))
            .When(profile => profile.BirthDate is not null);

        RuleFor(profile => profile.Conditions).NotNull();
        RuleForEach(profile => profile.Conditions)
            .Must(HealthCondition.Codes.Contains)
            .WithMessage("'{PropertyValue}' is not a health condition code.");
        RuleFor(profile => profile.Conditions)
            .Must(conditions => !conditions.Contains(HealthCondition.None) || conditions.Count == 1)
            .When(profile => profile.Conditions is not null)
            .WithMessage($"'{HealthCondition.None}' cannot be combined with other conditions.");

        RuleFor(profile => profile.OtherCondition).MaximumLength(200);
        RuleFor(profile => profile.OtherCondition)
            .Empty()
            .When(profile => profile.Conditions?.Contains(HealthCondition.Other) != true)
            .WithMessage($"OtherCondition needs the '{HealthCondition.Other}' code.");

        RuleFor(profile => profile.UpdatedAt).NotEmpty();
    }
}
