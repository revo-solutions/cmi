using FluentValidation;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class ContactModelValidator : AbstractValidator<ContactModel>
{
    public ContactModelValidator()
    {
        RuleFor(contact => contact.Id).NotEmpty();
        RuleFor(contact => contact.UpdatedAt).NotEmpty();

        When(contact => !contact.Deleted, () =>
        {
            RuleFor(contact => contact.Name).NotEmpty().MaximumLength(200);
            RuleFor(contact => contact.Phone).NotEmpty().MaximumLength(30);
            RuleFor(contact => contact.Relationship).IsInEnum();
        });
    }
}
