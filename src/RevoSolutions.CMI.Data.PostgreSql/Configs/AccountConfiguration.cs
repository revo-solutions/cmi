using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Data.PostgreSql.Configs;

public class AccountConfiguration : IEntityTypeConfiguration<Account>
{
    public void Configure(EntityTypeBuilder<Account> builder)
    {
        builder.ToTable("Accounts");

        builder.HasKey(a => a.Id);

        builder.Property(a => a.Provider).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.Subject).HasMaxLength(255).IsRequired();
        builder.Property(a => a.Email).HasMaxLength(320);
        builder.Property(a => a.OtherCondition).HasMaxLength(200);
        builder.Property(a => a.Platform).HasConversion<string>().HasMaxLength(20);
        builder.Property(a => a.TimeZone).HasMaxLength(100);
        builder.Property(a => a.PushToken).HasMaxLength(200);

        builder.HasIndex(a => new { a.Provider, a.Subject }).IsUnique();
    }
}
