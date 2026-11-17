using RevoSolutions.CMI.Domain.Contracts.Messaging;

namespace RevoSolutions.CMI.Anticorruption.WhatsApp;

public sealed class WhatsAppNoticeSender : INoticeSender
{
    private readonly WhatsAppClient _client;

    public WhatsAppNoticeSender(WhatsAppClient client)
    {
        _client = client;
    }

    public Task<string?> Send(string to, NoticeMessage message, CancellationToken cancellationToken = default) =>
        _client.SendTemplate(to, TemplateName(message.Template), message.Parameters, cancellationToken);

    // The names the templates are approved under in WhatsApp Manager (docs/arquitetura.md, "Modelos de mensagem").
    public static string TemplateName(NoticeTemplate template) => template switch
    {
        NoticeTemplate.MissedDose => "dose_sem_confirmacao",
        NoticeTemplate.DailySummary => "resumo_diario",
        NoticeTemplate.DailySummaryNoData => "resumo_sem_dados",
        NoticeTemplate.NoContact => "celular_sem_contato",
        NoticeTemplate.Uninstalled => "app_desinstalado",
        NoticeTemplate.Paused => "avisos_pausados",
        NoticeTemplate.Birthday => "aniversario",
        NoticeTemplate.Sos => "pedido_de_ajuda",
        _ => throw new ArgumentOutOfRangeException(nameof(template), template, "No WhatsApp template for it."),
    };
}
