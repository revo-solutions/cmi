namespace RevoSolutions.CMI.Domain.Core.Exceptions;

// For a rule that depends on the resource, which an [Authorize] policy on the action can't see.
public class DomainForbiddenException : DomainException
{
    public DomainForbiddenException(string message)
        : base(message)
    {
    }
}
