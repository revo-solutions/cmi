using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Entities;

// The person, identified by their social login, with the profile on the same row: there is exactly one of each.
public class Account : EntityBase
{
    public LoginProvider Provider { get; set; }

    public string Subject { get; set; } = string.Empty;

    // With Apple's "Hide my email" this is a relay address, not the real one.
    public string? Email { get; set; }

    public Guid ActiveDeviceId { get; set; }

    public DateOnly? BirthDate { get; set; }

    // HealthCondition codes, never display text.
    public List<string> Conditions { get; set; } = [];

    public string? OtherCondition { get; set; }

    public bool? LivesAlone { get; set; }

    public bool? FellLastYear { get; set; }

    public bool? VisionDifficulty { get; set; }

    // Null until the device first sends the profile.
    public DateTime? ProfileUpdatedAt { get; set; }

    public static Account Create(LoginProvider provider, string subject, string? email, Guid deviceId) => new()
    {
        Provider = provider,
        Subject = subject,
        Email = email,
        ActiveDeviceId = deviceId,
    };

    public bool IsProfileOlderThan(DateTimeOffset updatedAt) => ProfileUpdatedAt is null || ProfileUpdatedAt < updatedAt.UtcDateTime;

    public void UpdateProfile(ProfileModel profile)
    {
        BirthDate = profile.BirthDate;
        Conditions = profile.Conditions.ToList();
        OtherCondition = profile.OtherCondition;
        LivesAlone = profile.LivesAlone;
        FellLastYear = profile.FellLastYear;
        VisionDifficulty = profile.VisionDifficulty;
        ProfileUpdatedAt = profile.UpdatedAt.UtcDateTime;
    }
}
