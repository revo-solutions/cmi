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

    // The scheduled time of a missed dose, every dose due then being in the same notice; or the time of an SOS.
    public TimeOnly? ScheduledTime { get; set; }

    // Where the phone was when an SOS was asked for, if it knew in time.
    public double? Latitude { get; set; }

    public double? Longitude { get; set; }

    public DateTime? SentAt { get; set; }

    // WhatsApp's id for the message, which its delivery statuses refer to. Null when nothing was sent.
    public string? MessageId { get; set; }

    // Null until the outbox hands the notice to SendNoticeHandler.
    public NoticeStatus? Status { get; set; }

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

    public void MarkSent(string? messageId, DateTime now)
    {
        MessageId = messageId;
        SentAt = now;
        Status = NoticeStatus.Sent;
    }

    public void MarkNotSent() => Status ??= NoticeStatus.NotSent;

    public void MarkFailed() => Status = NoticeStatus.Failed;

    // WhatsApp may report the statuses out of order; an earlier one never undoes a later one.
    public void UpdateDelivery(NoticeStatus status)
    {
        if (Status >= NoticeStatus.Sent && status > Status)
        {
            Status = status;
        }
    }
}
