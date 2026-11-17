using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Events;

namespace RevoSolutions.CMI.Domain.Entities;

// A notice the server decided to send to the trusted contact. The unique Key is what keeps a notice from being decided
// twice; SentAt keeps an outbox retry from paying for it twice. The message itself is built when it is sent.
public class Notice : EntityBase
{
    public Guid AccountId { get; set; }

    public NoticeKind Kind { get; set; }

    public string Key { get; set; } = string.Empty;

    // The person's local date the notice is about, which the daily cap counts by.
    public DateOnly Day { get; set; }

    // The scheduled time of a missed dose; every dose due then is in the same notice.
    public TimeOnly? ScheduledTime { get; set; }

    public DateTime? SentAt { get; set; }

    public static Notice Create(Guid accountId, NoticeKind kind, string key, DateOnly day, TimeOnly? scheduledTime)
    {
        var notice = new Notice
        {
            AccountId = accountId,
            Kind = kind,
            Key = key,
            Day = day,
            ScheduledTime = scheduledTime,
        };
        notice.AddDomainEvent(new NoticeCreatedDomainEvent(notice.Id, notice.CreatedDate));

        return notice;
    }
}
