using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Domain.Contracts.Messaging;

// Implemented by the WhatsApp integration, which also decides what the message says. Throwing leaves the notice unsent,
// and the outbox retries it.
public interface INoticeSender
{
    Task Send(Notice notice, Contact contact, CancellationToken cancellationToken = default);
}
