namespace RevoSolutions.CMI.Domain.Models;

// A null answer is one the person skipped.
public record ProfileModel(
    DateOnly? BirthDate,
    IReadOnlyList<string> Conditions,
    string? OtherCondition,
    bool? LivesAlone,
    bool? FellLastYear,
    bool? VisionDifficulty,
    DateTimeOffset UpdatedAt);
