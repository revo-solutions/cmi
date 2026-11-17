using RevoSolutions.CMI.Domain.Contracts.Messaging;
using RevoSolutions.CMI.Domain.Core.Contracts.Events;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Events;
using RevoSolutions.CMI.Domain.Services;

namespace RevoSolutions.CMI.Domain.Handlers;

public class SendNoticeHandler : IDomainEventHandler<NoticeCreatedDomainEvent>
{
    private readonly IRepository<Notice> _notices;
    private readonly IRepository<Account> _accounts;
    private readonly IRepository<Contact> _contacts;
    private readonly NoticeMessageBuilder _messages;
    private readonly INoticeSender _sender;
    private readonly IUnitOfWork _unitOfWork;

    public SendNoticeHandler(
        IRepository<Notice> notices,
        IRepository<Account> accounts,
        IRepository<Contact> contacts,
        NoticeMessageBuilder messages,
        INoticeSender sender,
        IUnitOfWork unitOfWork)
    {
        _notices = notices;
        _accounts = accounts;
        _contacts = contacts;
        _messages = messages;
        _sender = sender;
        _unitOfWork = unitOfWork;
    }

    public async Task HandleAsync(NoticeCreatedDomainEvent domainEvent, CancellationToken cancellationToken = default)
    {
        var notice = await _notices.FirstOrDefault(n => n.Id == domainEvent.NoticeId);

        // The outbox delivers at least once; a notice already sent is not paid for twice. A deleted account takes its
        // notices with it.
        if (notice is null || notice.SentAt is not null)
        {
            return;
        }

        // Premium ended after the notice was decided: it is never sent, not even on subscribing again.
        var account = await _accounts.FirstOrDefault(a => a.Id == notice.AccountId);
        if (account?.IsPremium(DateTime.UtcNow) != true)
        {
            return;
        }

        // Revoked, or PARAR, after the notice was decided: nobody to tell.
        var contact = await _contacts.FirstOrDefault(c => c.AccountId == notice.AccountId);
        if (contact?.WhatsAppNumber is null || !contact.ReceivesNotices())
        {
            return;
        }

        if (await _messages.Build(notice, contact) is not { } message)
        {
            return;
        }

        await _sender.Send(contact.WhatsAppNumber, message, cancellationToken);

        notice.SentAt = DateTime.UtcNow;
        await _unitOfWork.CommitAsync();
    }
}
