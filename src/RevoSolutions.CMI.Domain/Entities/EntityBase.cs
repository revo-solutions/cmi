using System.ComponentModel.DataAnnotations.Schema;
using RevoSolutions.CMI.Domain.Core.Contracts.Events;

namespace RevoSolutions.CMI.Domain.Entities;

public abstract class EntityBase : IHasDomainEvents
{
    private readonly List<IDomainEvent> _domainEvents = new();

    protected EntityBase() => CreatedDate = DateTime.UtcNow;

    public Guid Id { get; set; } = Guid.CreateVersion7();

    public DateTime CreatedDate { get; set; }

    [NotMapped]
    public IReadOnlyCollection<IDomainEvent> DomainEvents => _domainEvents.AsReadOnly();

    public void ClearDomainEvents() => _domainEvents.Clear();

    protected void AddDomainEvent(IDomainEvent domainEvent) => _domainEvents.Add(domainEvent);
}
