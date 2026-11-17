namespace RevoSolutions.CMI.Data.PostgreSql.Outbox;

public class OutboxMessage
{
    public Guid Id { get; set; } = Guid.NewGuid();

    public DateTime OccurredOn { get; set; }

    public string Type { get; set; } = string.Empty;

    public string Content { get; set; } = string.Empty;

    public DateTime? ProcessedOn { get; set; }

    public string? Error { get; set; }
}
