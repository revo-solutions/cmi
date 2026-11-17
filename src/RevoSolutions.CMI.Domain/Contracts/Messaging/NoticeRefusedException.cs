namespace RevoSolutions.CMI.Domain.Contracts.Messaging;

// The messaging service refused the message itself (a template or a value it won't take, a number it rejects):
// sending it again would only fail again.
public class NoticeRefusedException : Exception
{
    public NoticeRefusedException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}
