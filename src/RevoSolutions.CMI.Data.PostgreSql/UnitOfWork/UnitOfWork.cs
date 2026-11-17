using RevoSolutions.CMI.Data.PostgreSql.Contexts;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;

namespace RevoSolutions.CMI.Data.PostgreSql.UnitOfWork;

public class UnitOfWork : IUnitOfWork
{
    private readonly CmiDbContext _dbContext;

    public UnitOfWork(CmiDbContext dbContext)
    {
        _dbContext = dbContext ?? throw new ArgumentNullException(nameof(dbContext));
    }

    public Task<int> CommitAsync()
    {
        return _dbContext.SaveChangesAsync();
    }

    public void Rollback()
    {
        _dbContext.ChangeTracker.Entries().ToList().ForEach(x => x.Reload());
    }
}
