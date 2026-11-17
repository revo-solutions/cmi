using RevoSolutions.CMI.Domain.Core.Contracts.Events;

namespace RevoSolutions.CMI.Domain.Events;

public sealed record NoticeCreatedDomainEvent(Guid NoticeId, DateTime OccurredOn) : IDomainEvent;
