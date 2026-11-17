using FluentValidation;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Validators;

public class HeartbeatModelValidator : AbstractValidator<HeartbeatModel>
{
    public HeartbeatModelValidator()
    {
        RuleFor(heartbeat => heartbeat.Platform).IsInEnum();

        RuleFor(heartbeat => heartbeat.TimeZone)
            .NotEmpty()
            .MaximumLength(100)
            .Must(timeZone => TimeZoneInfo.TryFindSystemTimeZoneById(timeZone, out _))
            .WithMessage("'{PropertyValue}' is not a known time zone.");

        RuleFor(heartbeat => heartbeat.PushToken).MaximumLength(200);
    }
}
