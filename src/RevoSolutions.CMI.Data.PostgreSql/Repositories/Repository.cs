using System.Linq.Expressions;
using Microsoft.EntityFrameworkCore;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;

namespace RevoSolutions.CMI.Data.PostgreSql.Repositories;

public class Repository<TEntity> : IRepository<TEntity>
    where TEntity : class
{
    private readonly DbSet<TEntity> _dbSet;

    public Repository(CmiDbContext dbContext)
    {
        ArgumentNullException.ThrowIfNull(dbContext);

        _dbSet = dbContext.Set<TEntity>();
    }

    public async Task<TEntity> Add(TEntity entity, CancellationToken cancellationToken = default)
    {
        var added = await _dbSet.AddAsync(entity, cancellationToken).ConfigureAwait(false);
        return added.Entity;
    }

    public void Remove(TEntity entity) => _dbSet.Remove(entity);

    public async Task<IReadOnlyList<TEntity>> Get(Expression<Func<TEntity, bool>> predicate) =>
        await _dbSet.Where(predicate).ToListAsync().ConfigureAwait(false);

    public Task<TEntity?> FirstOrDefault(Expression<Func<TEntity, bool>> predicate) =>
        _dbSet.FirstOrDefaultAsync(predicate);
}
