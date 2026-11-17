namespace RevoSolutions.CMI.Domain.Contracts.Push;

// Implemented by the Expo push integration. Throwing leaves the ping unsent, and the outbox retries it.
public interface IPushSender
{
    // A silent push that wakes the app into sending a heartbeat. Returns the ticket whose receipt tells later whether it
    // reached the phone, or null when the token already no longer reaches the app.
    Task<string?> Ping(string pushToken, CancellationToken cancellationToken = default);

    // Whether the ticket's receipt says the token no longer reaches the app: uninstalled, or notifications turned off.
    // A receipt not ready yet, or any other outcome, is false.
    Task<bool> IsUnregistered(string ticketId, CancellationToken cancellationToken = default);
}
