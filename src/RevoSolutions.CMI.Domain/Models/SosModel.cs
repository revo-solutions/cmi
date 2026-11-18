using RevoSolutions.CMI.Domain.Enumerators;

namespace RevoSolutions.CMI.Domain.Models;

// A help request, with an Id the app generates so the outgoing queue can send it again safely. RequestedAt keeps the
// phone's offset: the message tells the family the time on the person's clock. The position, when the phone had one in
// time, reaches the family as a map link.
public record SosModel(Guid Id, DateTimeOffset RequestedAt, double? Latitude = null, double? Longitude = null);

// Status is null while the request waits for the outbox, a few seconds.
public record SosStatusModel(Guid Id, NoticeStatus? Status);
