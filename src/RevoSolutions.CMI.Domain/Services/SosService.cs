using RevoSolutions.CMI.Domain.Authorization;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Core.Exceptions;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Services;

// The help request over WhatsApp, Premium only: a notice like the others, sent by the outbox within seconds, whose
// delivery status the app shows. SendNoticeHandler checks Premium and the contact, and marks it NotSent otherwise; the
// app then offers to call. The free SOS (a call or an SMS from the phone) never reaches the server.
public class SosService
{
    private readonly IRepository<Notice> _notices;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentAccount _currentAccount;

    public SosService(IRepository<Notice> notices, IUnitOfWork unitOfWork, ICurrentAccount currentAccount)
    {
        _notices = notices;
        _unitOfWork = unitOfWork;
        _currentAccount = currentAccount;
    }

    // The same request sent again is the same notice.
    public async Task<SosStatusModel> Request(SosModel request)
    {
        var key = Key(request.Id);
        if (await _notices.FirstOrDefault(n => n.Key == key) is null)
        {
            var local = request.RequestedAt.DateTime;
            await _notices.Add(Notice.Create(
                _currentAccount.AccountId,
                NoticeKind.Sos,
                key,
                DateOnly.FromDateTime(local),
                new TimeOnly(local.Hour, local.Minute)));
            await _unitOfWork.CommitAsync();
        }

        return await Get(request.Id);
    }

    public async Task<SosStatusModel> Get(Guid id)
    {
        var key = Key(id);
        var notice = await _notices.FirstOrDefault(n => n.Key == key)
            ?? throw new DomainNotFoundException("No such help request.");

        return new SosStatusModel(id, notice.Status);
    }

    private string Key(Guid id) => $"{_currentAccount.AccountId}:{NoticeKind.Sos}:{id}";
}
