using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using RevoSolutions.CMI.Domain.Entities;

namespace RevoSolutions.CMI.Data.PostgreSql.Configs;

public class ContactConfiguration : IEntityTypeConfiguration<Contact>
{
    public void Configure(EntityTypeBuilder<Contact> builder)
    {
        builder.ToTable("Contacts");

        builder.HasKey(c => c.Id);

        builder.Property(c => c.Name).HasMaxLength(200).IsRequired();
        builder.Property(c => c.Phone).HasMaxLength(30).IsRequired();
        builder.Property(c => c.Relationship).HasConversion<string>().HasMaxLength(20);
        builder.Property(c => c.LinkCode).HasMaxLength(Contact.LinkCodeLength).IsRequired();
        builder.Property(c => c.WhatsAppNumber).HasMaxLength(20);

        builder.HasIndex(c => c.AccountId);
        builder.HasIndex(c => c.LinkCode).IsUnique();
        builder.HasIndex(c => c.WhatsAppNumber);
    }
}
