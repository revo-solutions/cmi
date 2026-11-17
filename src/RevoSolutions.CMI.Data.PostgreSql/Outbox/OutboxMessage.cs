namespace RevoSolutions.CMI.Data.PostgreSql.Outbox;

public class OutboxMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime OccurredOn { get; set; }

    public string Type { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public DateTime? ProcessedOn { get; set; }

    // The last failure. A message still unprocessed with OutboxProcessor.MaxAttempts attempts was given up on.
    public string? Error { get; set; }

    public int Attempts { get; set; }

    // Null until the first failure; the message waits until then to be tried again.
    public DateTime? NextAttemptAt { get; set; }
}
