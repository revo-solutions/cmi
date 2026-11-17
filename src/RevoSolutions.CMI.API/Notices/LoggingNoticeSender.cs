using RevoSolutions.CMI.Domain.Contracts.Messaging;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.API.Notices;

// Stands in for WhatsApp until Anticorruption.WhatsApp replaces it. Logs ids only, never the contact's phone.
public sealed class LoggingNoticeSender : INoticeSender
{
    private readonly ILogger<LoggingNoticeSender> _logger;

    public LoggingNoticeSender(ILogger<LoggingNoticeSender> logger)
    {
        _logger = logger;
    }

    public Task Send(Notice notice, Contact contact, CancellationToken cancellationToken = default)
    {
        if (_logger.IsEnabled(LogLevel.Information))
        {
            _logger.LogInformation(
                "Notice {Kind} {NoticeId} for account {AccountId} would go to contact {ContactId}.",
                notice.Kind,
                notice.Id,
                notice.AccountId,
                contact.Id);
        }

        return Task.CompletedTask;
    }
}
