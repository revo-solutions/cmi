using RevoSolutions.CMI.Domain.Contracts.Messaging;
using RevoSolutions.CMI.Domain.Core.Contracts.Events;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Events;

namespace RevoSolutions.CMI.Domain.Handlers;

public class SendNoticeHandler : IDomainEventHandler<NoticeCreatedDomainEvent>
{
    private readonly IRepository<Notice> _notices;
    private readonly IRepository<Contact> _contacts;
    private readonly INoticeSender _sender;
    private readonly IUnitOfWork _unitOfWork;

    public SendNoticeHandler(IRepository<Notice> notices, IRepository<Contact> contacts, INoticeSender sender, IUnitOfWork unitOfWork)
    {
        _notices = notices;
        _contacts = contacts;
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

        // Revoked after the notice was decided: nobody to tell.
        var contact = await _contacts.FirstOrDefault(c => c.AccountId == notice.AccountId);
        if (contact is null)
        {
            return;
        }

        await _sender.Send(notice, contact, cancellationToken);

        notice.SentAt = DateTime.UtcNow;
        await _unitOfWork.CommitAsync();
    }
}
