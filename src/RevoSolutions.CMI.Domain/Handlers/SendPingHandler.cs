using RevoSolutions.CMI.Domain.Contracts.Push;
using RevoSolutions.CMI.Domain.Core.Contracts.Events;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Events;

namespace RevoSolutions.CMI.Domain.Handlers;

public class SendPingHandler : IDomainEventHandler<DevicePingRequestedDomainEvent>
{
    private readonly IRepository<Account> _accounts;
    private readonly IPushSender _push;
    private readonly IUnitOfWork _unitOfWork;

    public SendPingHandler(IRepository<Account> accounts, IPushSender push, IUnitOfWork unitOfWork)
    {
        _accounts = accounts;
        _push = push;
        _unitOfWork = unitOfWork;
    }

    // A ping is free, so a retried delivery may push twice; the phone answering meanwhile needs no ping at all.
    public async Task HandleAsync(DevicePingRequestedDomainEvent domainEvent, CancellationToken cancellationToken = default)
    {
        var account = await _accounts.FirstOrDefault(a => a.Id == domainEvent.AccountId);
        if (account?.PushToken is not { } pushToken || account.LastSeenAt > domainEvent.OccurredOn)
        {
            return;
        }

        if (await _push.Ping(pushToken, cancellationToken) is { } ticketId)
        {
            account.PingTicketId = ticketId;
        }
        else
        {
            account.MarkPushUnregistered(DateTime.UtcNow);
        }

        await _unitOfWork.CommitAsync();
    }
}
