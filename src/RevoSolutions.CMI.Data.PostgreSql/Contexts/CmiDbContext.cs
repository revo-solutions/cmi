using Microsoft.EntityFrameworkCore;
using RevoSolutions.CMI.Data.PostgreSql.Authentication;
using RevoSolutions.CMI.Data.PostgreSql.Outbox;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Data.PostgreSql.Contexts;

public class CmiDbContext : DbContext
{
    public CmiDbContext(DbContextOptions<CmiDbContext> options)
        : base(options)
    {
    }

    public DbSet<Account> Accounts => Set<Account>();

    public DbSet<OutboxMessage> OutboxMessages => Set<OutboxMessage>();

    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        modelBuilder.ApplyConfigurationsFromAssembly(typeof(CmiDbContext).Assembly);

        foreach (var entityType in modelBuilder.Model.GetEntityTypes())
        {
            // The key is set before the insert (by EntityBase, or by the device for synced records). Left as
            // "generated", EF treats a new entity with a preset key as existing and UPDATEs a row that isn't there.
            if (typeof(EntityBase).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType).Property(nameof(EntityBase.Id)).ValueGeneratedNever();
            }

            // Everything of an account goes with it: deleting the account deletes all its data.
            if (typeof(SyncedEntityBase).IsAssignableFrom(entityType.ClrType))
            {
                modelBuilder.Entity(entityType.ClrType)
                    .HasOne(typeof(Account))
                    .WithMany()
                    .HasForeignKey(nameof(SyncedEntityBase.AccountId))
                    .OnDelete(DeleteBehavior.Cascade);
            }
        }
    }
}
