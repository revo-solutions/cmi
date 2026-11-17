using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Events;
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

    // The active device's facts, sent with every heartbeat. Null until the first one.
    public DevicePlatform? Platform { get; set; }

    // IANA id ("America/Sao_Paulo"): the medications' times and the 20:00 summary are in it.
    public string? TimeZone { get; set; }

    // Expo push token, for the ping before a no-contact notice.
    public string? PushToken { get; set; }

    // The server's clock at the active device's last login, upload or heartbeat; the notice rules read it.
    public DateTime? LastSeenAt { get; set; }

    // When the server last pinged the device for going quiet; a ping later than LastSeenAt is still unanswered.
    public DateTime? PingSentAt { get; set; }

    // The latest "Tomei" received, for the abandonment pause.
    public DateTime? LastTakenAt { get; set; }

    // How the notices name the person ("sua mãe, Maria"). The app prefills it from the login.
    public string? Name { get; set; }

    public DateOnly? BirthDate { get; set; }

    // HealthCondition codes, never display text.
    public List<string> Conditions { get; set; } = [];

    public string? OtherCondition { get; set; }

    public bool? LivesAlone { get; set; }

    public bool? FellLastYear { get; set; }

    public bool? VisionDifficulty { get; set; }

    // Null until the device first sends the profile.
    public DateTime? ProfileUpdatedAt { get; set; }

    // Set only from RevenueCat, never from the app; grace periods included. Null never had Premium.
    public DateTime? PremiumUntil { get; set; }

    public bool IsPremium(DateTime now) => PremiumUntil > now;

    public static Account Create(LoginProvider provider, string subject, string? email, Guid deviceId) => new()
    {
        Provider = provider,
        Subject = subject,
        Email = email,
        ActiveDeviceId = deviceId,
        LastSeenAt = DateTime.UtcNow,
    };

    // A new device's push token comes with its first heartbeat; the old one must not get pings meanwhile.
    public void ActivateDevice(Guid deviceId)
    {
        if (deviceId != ActiveDeviceId)
        {
            ActiveDeviceId = deviceId;
            PushToken = null;
        }

        MarkSeen();
    }

    public void MarkSeen() => LastSeenAt = DateTime.UtcNow;

    public void RecordTaken(DateTimeOffset takenAt)
    {
        if (LastTakenAt is null || LastTakenAt < takenAt.UtcDateTime)
        {
            LastTakenAt = takenAt.UtcDateTime;
        }
    }

    // The push wakes the app into sending a heartbeat; the family hears about it only if none comes.
    public void RequestPing(DateTime now)
    {
        PingSentAt = now;
        AddDomainEvent(new DevicePingRequestedDomainEvent(Id, now));
    }

    public void RecordHeartbeat(HeartbeatModel heartbeat)
    {
        Platform = heartbeat.Platform;
        TimeZone = heartbeat.TimeZone;
        PushToken = heartbeat.PushToken;
        MarkSeen();
    }

    public bool IsProfileOlderThan(DateTimeOffset updatedAt) => ProfileUpdatedAt is null || ProfileUpdatedAt < updatedAt.UtcDateTime;

    public void UpdateProfile(ProfileModel profile)
    {
        Name = profile.Name;
        BirthDate = profile.BirthDate;
        Conditions = profile.Conditions.ToList();
        OtherCondition = profile.OtherCondition;
        LivesAlone = profile.LivesAlone;
        FellLastYear = profile.FellLastYear;
        VisionDifficulty = profile.VisionDifficulty;
        ProfileUpdatedAt = profile.UpdatedAt.UtcDateTime;
    }
}
