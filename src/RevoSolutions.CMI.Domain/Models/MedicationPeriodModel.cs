namespace RevoSolutions.CMI.Domain.Models;

// StartsAt is an instant; the times are the person's wall clock.
public record MedicationPeriodModel(
    Guid Id,
    Guid MedicationId,
    DateTimeOffset StartsAt,
    IReadOnlyList<TimeOnly> Times,
    bool Paused,
    DateTimeOffset UpdatedAt);
