using System.Net;
using Microsoft.Extensions.Logging;
using RevoSolutions.CMI.Domain.Contracts.Messaging;

namespace RevoSolutions.CMI.Anticorruption.WhatsApp;

public sealed class WhatsAppNoticeSender : INoticeSender
{
    private readonly WhatsAppClient _client;
    private readonly ILogger<WhatsAppNoticeSender> _logger;

    public WhatsAppNoticeSender(WhatsAppClient client, ILogger<WhatsAppNoticeSender> logger)
    {
        _client = client;
        _logger = logger;
    }

    // Meta answers 400 to a message it won't take as it is: an unapproved template, a wrong value, a number it rejects.
    // Anything else (rate limits, an expired token, an outage) may pass later, so the outbox retries it.
    public async Task<string?> Send(string to, NoticeMessage message, CancellationToken cancellationToken = default)
    {
        try
        {
            return await _client.SendTemplate(to, TemplateName(message.Template), message.Parameters, cancellationToken);
        }
        catch (HttpRequestException exception) when (exception.StatusCode == HttpStatusCode.BadRequest)
        {
            _logger.LogError(exception, "WhatsApp refused the {Template} notice.", message.Template);
            throw new NoticeRefusedException(exception.Message, exception);
        }
    }

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
