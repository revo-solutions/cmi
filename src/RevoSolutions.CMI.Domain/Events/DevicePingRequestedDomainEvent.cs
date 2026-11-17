using RevoSolutions.CMI.Domain.Core.Contracts.Events;

namespace RevoSolutions.CMI.Domain.Events;

// The device went quiet past the limit; SendPingHandler pushes it a ping.
public sealed record DevicePingRequestedDomainEvent(Guid AccountId, DateTime OccurredOn) : IDomainEvent;
