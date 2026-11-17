using System.Linq.Expressions;

namespace RevoSolutions.CMI.Domain.Core.Contracts.Repositories;

public interface IRepository<TEntity>
    where TEntity : class
{
    Task<TEntity> Add(TEntity entity, CancellationToken cancellationToken = default);

    void Remove(TEntity entity);

    Task<IReadOnlyList<TEntity>> Get(Expression<Func<TEntity, bool>> predicate);

    Task<TEntity?> FirstOrDefault(Expression<Func<TEntity, bool>> predicate);
}
