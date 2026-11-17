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

        // The outbox delivers at least once; a notice already handled is not paid for twice. A deleted account takes its
        // notices with it.
        if (notice is null || notice.Status is not null)
        {
            return;
        }

        if (await Message(notice) is { } send)
        {
            try
            {
                notice.MarkSent(await _sender.Send(send.To, send.Message, cancellationToken), DateTime.UtcNow);
            }
            catch (NoticeRefusedException)
            {
                // The app shows a failed SOS at once and offers the call, instead of waiting on retries.
                notice.MarkFailed();
            }
        }
        else
        {
            notice.MarkNotSent();
        }

        await _unitOfWork.CommitAsync();
    }

    private async Task<(string To, NoticeMessage Message)?> Message(Notice notice)
    {
        // Premium ended after the notice was decided (or never was, for an SOS): it is never sent, not even on
        // subscribing again.
        var account = await _accounts.FirstOrDefault(a => a.Id == notice.AccountId);
        if (account?.IsPremium(DateTime.UtcNow) != true)
        {
            return null;
        }

        // No linked contact, revoked, or PARAR: nobody to tell.
        var contact = await _contacts.FirstOrDefault(c => c.AccountId == notice.AccountId);
        if (contact?.WhatsAppNumber is null || !contact.ReceivesNotices())
        {
            return null;
        }

        return await _messages.Build(notice, contact) is { } message ? (contact.WhatsAppNumber, message) : null;
    }
}
