using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Data.PostgreSql.Configs;

public class NoticeConfiguration : IEntityTypeConfiguration<Notice>
{
    public void Configure(EntityTypeBuilder<Notice> builder)
    {
        builder.ToTable("Notices");

        builder.HasKey(n => n.Id);

        builder.Property(n => n.Kind).HasConversion<string>().HasMaxLength(20);
        builder.Property(n => n.Key).HasMaxLength(150).IsRequired();

        builder.HasOne<Account>()
            .WithMany()
            .HasForeignKey(n => n.AccountId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(n => n.Key).IsUnique();
        builder.HasIndex(n => new { n.AccountId, n.Day });
    }
}
