namespace RevoSolutions.CMI.Domain.Models;

public record MedicationModel(
    Guid Id,
    string Name,
    string? Dose,
    IReadOnlyList<TimeOnly> Times,
    bool Paused,
    bool SharedWithContact,
    bool Deleted,
    DateTimeOffset UpdatedAt);
