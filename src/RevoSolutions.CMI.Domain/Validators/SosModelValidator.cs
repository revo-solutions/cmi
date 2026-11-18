using FluentValidation;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class SosModelValidator : AbstractValidator<SosModel>
{
    public SosModelValidator()
    {
        RuleFor(sos => sos.Id).NotEmpty();
        RuleFor(sos => sos.RequestedAt).NotEmpty();
        RuleFor(sos => sos.Latitude).InclusiveBetween(-90, 90);
        RuleFor(sos => sos.Longitude).InclusiveBetween(-180, 180);
        RuleFor(sos => sos.Latitude.HasValue).Equal(sos => sos.Longitude.HasValue)
            .WithMessage("A position needs both latitude and longitude.");
    }
}
