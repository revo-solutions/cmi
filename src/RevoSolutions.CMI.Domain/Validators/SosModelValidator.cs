using FluentValidation;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class SosModelValidator : AbstractValidator<SosModel>
{
    public SosModelValidator()
    {
        RuleFor(sos => sos.Id).NotEmpty();
        RuleFor(sos => sos.RequestedAt).NotEmpty();
    }
}
