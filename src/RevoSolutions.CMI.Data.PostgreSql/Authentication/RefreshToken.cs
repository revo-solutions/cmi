namespace RevoSolutions.CMI.Data.PostgreSql.Authentication;

public class RefreshToken
{
    public Guid Id { get; set; } = Guid.CreateVersion7();

    public Guid AccountId { get; set; }

    // The device the session belongs to; a refresh keeps it.
    public Guid DeviceId { get; set; }

    public string TokenHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime ExpiresAt { get; set; }

    public DateTime? RotatedAt { get; set; }

    public DateTime? RevokedAt { get; set; }
}
