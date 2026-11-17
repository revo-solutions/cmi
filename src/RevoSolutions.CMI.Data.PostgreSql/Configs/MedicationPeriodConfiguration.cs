using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Data.PostgreSql.Configs;

public class MedicationPeriodConfiguration : IEntityTypeConfiguration<MedicationPeriod>
{
    public void Configure(EntityTypeBuilder<MedicationPeriod> builder)
    {
        builder.ToTable("MedicationPeriods");

        builder.HasKey(p => p.Id);

        builder.HasOne<Medication>()
            .WithMany()
            .HasForeignKey(p => p.MedicationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(p => p.AccountId);
        builder.HasIndex(p => p.MedicationId);
    }
}
