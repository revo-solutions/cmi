namespace RevoSolutions.CMI.Domain.Enumerators;

// How far a notice got. NotSent is the server deciding not to send it (no Premium, no linked contact, PARAR, nothing
// left to say); the rest are WhatsApp's statuses, which only move forward, in this order. Failed is also WhatsApp
// refusing to take the message at all.
public enum NoticeStatus
{
    NotSent,
    Sent,
    Delivered,
    Read,
    Failed,
}
