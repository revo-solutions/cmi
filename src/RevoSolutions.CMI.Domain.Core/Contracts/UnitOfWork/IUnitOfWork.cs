namespace RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;

public interface IUnitOfWork
{
    void Rollback();

    Task<int> CommitAsync();
}
