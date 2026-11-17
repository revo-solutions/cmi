namespace RevoSolutions.CMI.Domain.Core.Exceptions;

public class DomainNotFoundException : DomainException
{
    public DomainNotFoundException(string message)
        : base(message)
    {
    }
}
