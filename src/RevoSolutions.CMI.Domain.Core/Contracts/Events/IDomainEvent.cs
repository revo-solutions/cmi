namespace RevoSolutions.CMI.Domain.Core.Contracts.Events;

public interface IDomainEvent
{
    DateTime OccurredOn { get; }
}
