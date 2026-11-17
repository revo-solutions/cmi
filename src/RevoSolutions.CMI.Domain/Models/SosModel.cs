using RevoSolutions.CMI.Domain.Enumerators;

namespace RevoSolutions.CMI.Domain.Models;

// A help request, with an Id the app generates so the outgoing queue can send it again safely. RequestedAt keeps the
// phone's offset: the message tells the family the time on the person's clock.
public record SosModel(Guid Id, DateTimeOffset RequestedAt);

// Status is null while the request waits for the outbox, a few seconds.
public record SosStatusModel(Guid Id, NoticeStatus? Status);
