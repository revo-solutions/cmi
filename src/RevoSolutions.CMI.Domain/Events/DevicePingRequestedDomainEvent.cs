using RevoSolutions.CMI.Domain.Core.Contracts.Events;

namespace RevoSolutions.CMI.Domain.Events;

// Handled by the push integration once it exists; until then the outbox marks it processed.
public sealed record DevicePingRequestedDomainEvent(Guid AccountId, DateTime OccurredOn) : IDomainEvent;
