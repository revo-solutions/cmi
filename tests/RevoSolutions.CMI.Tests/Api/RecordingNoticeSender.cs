using System.Collections.Concurrent;
using RevoSolutions.CMI.Domain.Contracts.Messaging;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Tests.Api;

public sealed class RecordingNoticeSender : INoticeSender
{
    public ConcurrentBag<(Guid NoticeId, Guid ContactId)> Sent { get; } = [];

    public Task Send(Notice notice, Contact contact, CancellationToken cancellationToken = default)
    {
        Sent.Add((notice.Id, contact.Id));

        return Task.CompletedTask;
    }
}
