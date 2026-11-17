using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Data.PostgreSql.Configs;

public class DoseRecordConfiguration : IEntityTypeConfiguration<DoseRecord>
{
    public void Configure(EntityTypeBuilder<DoseRecord> builder)
    {
        builder.ToTable("DoseRecords");

        builder.HasKey(d => d.Id);

        builder.HasOne<Medication>()
            .WithMany()
            .HasForeignKey(d => d.MedicationId)
            .OnDelete(DeleteBehavior.Cascade);

        builder.HasIndex(d => new { d.AccountId, d.ScheduledDate });
        builder.HasIndex(d => d.MedicationId);
    }
}
