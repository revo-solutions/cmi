namespace RevoSolutions.CMI.Domain.Models;

// The scheduled date and time are the person's wall clock; TakenAt is an instant.
public record DoseRecordModel(
    Guid Id,
    Guid MedicationId,
    DateOnly ScheduledDate,
    TimeOnly ScheduledTime,
    DateTimeOffset? TakenAt,
    DateTimeOffset UpdatedAt);
