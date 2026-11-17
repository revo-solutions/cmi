using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace RevoSolutions.CMI.Data.PostgreSql.Outbox;

public class OutboxMessageConfiguration : IEntityTypeConfiguration<OutboxMessage>
{
    public void Configure(EntityTypeBuilder<OutboxMessage> builder)
    {
        builder.ToTable("OutboxMessages");

        builder.HasKey(p => p.Id);

        builder.Property(p => p.OccurredOn).IsRequired();
        builder.Property(p => p.Type).HasMaxLength(500).IsRequired();
        builder.Property(p => p.Content).IsRequired();

        builder.HasIndex(p => p.ProcessedOn);
        builder.HasIndex(p => p.OccurredOn);
    }
}
