using RevoSolutions.CMI.Domain.Enumerators;

namespace RevoSolutions.CMI.Domain.Models;

// Deleted is only ever sent by the device; the server forgets a deleted contact.
public record ContactModel(
    Guid Id,
    string Name,
    string Phone,
    Relationship Relationship,
    bool Deleted,
    DateTimeOffset UpdatedAt);
