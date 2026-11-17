namespace RevoSolutions.CMI.Domain.Entities;

// A record born on the device: the device picks the Id, and UpdatedAt is the device's clock at the last change.
public abstract class SyncedEntityBase : EntityBase
{
    public Guid AccountId { get; set; }

    public DateTime UpdatedAt { get; set; }

    // The last change wins; an equal timestamp is the same change sent again.
    public bool IsOlderThan(DateTimeOffset updatedAt) => UpdatedAt < updatedAt.UtcDateTime;
}
