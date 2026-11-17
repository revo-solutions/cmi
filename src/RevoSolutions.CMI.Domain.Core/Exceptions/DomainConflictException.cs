namespace RevoSolutions.CMI.Domain.Core.Exceptions;

// For a request that is valid but clashes with the current state, such as a sync from a device that is no longer active.
public class DomainConflictException : DomainException
{
    public DomainConflictException(string message)
        : base(message)
    {
    }
}
