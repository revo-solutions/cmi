namespace RevoSolutions.CMI.Domain.Contracts.Messaging;

// Implemented by the WhatsApp integration. Throwing leaves the notice unsent, and the outbox retries it.
public interface INoticeSender
{
    Task Send(string to, NoticeMessage message, CancellationToken cancellationToken = default);
}

// What a notice says: one of the approved templates (docs/arquitetura.md, "Modelos de mensagem") and its values, in order.
public record NoticeMessage(NoticeTemplate Template, IReadOnlyList<string> Parameters);

public enum NoticeTemplate
{
    MissedDose,
    DailySummary,
    DailySummaryNoData,
    NoContact,
    Uninstalled,
    Paused,
    Birthday,
}
