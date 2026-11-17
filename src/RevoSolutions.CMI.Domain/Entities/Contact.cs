using System.Security.Cryptography;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Entities;

// The trusted contact. Removing it deletes the row: the contact's data must leave the server.
public class Contact : SyncedEntityBase
{
    // No 0/O or 1/I/L, so the code survives being read aloud or retyped.
    private const string LinkCodeAlphabet = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

    public const int LinkCodeLength = 8;

    public string Name { get; set; } = string.Empty;

    // As the person typed it, for calls and SMS from the phone.
    public string Phone { get; set; } = string.Empty;

    public Relationship Relationship { get; set; }

    // Goes in the prefilled WhatsApp message the family member sends to link up.
    public string LinkCode { get; set; } = string.Empty;

    // The number the link code came from, as WhatsApp reports it; notices go there, not to Phone.
    public string? WhatsAppNumber { get; set; }

    public DateTime? LinkedAt { get; set; }

    // The family member answered PARAR. Sending the link code again undoes it.
    public DateTime? StoppedAt { get; set; }

    public static Contact Create(Guid accountId, ContactModel model)
    {
        var contact = new Contact { Id = model.Id, AccountId = accountId };
        contact.Update(model);

        return contact;
    }

    public void Update(ContactModel model)
    {
        // Another phone is another person: they link up themselves, with a code the previous one never saw.
        if (model.Phone != Phone)
        {
            LinkCode = RandomNumberGenerator.GetString(LinkCodeAlphabet, LinkCodeLength);
            WhatsAppNumber = null;
            LinkedAt = null;
            StoppedAt = null;
        }

        Name = model.Name;
        Phone = model.Phone;
        Relationship = model.Relationship;
        UpdatedAt = model.UpdatedAt.UtcDateTime;
    }

    public bool ReceivesNotices() => LinkedAt is not null && StoppedAt is null;

    public void Link(string whatsAppNumber, DateTime now)
    {
        if (whatsAppNumber != WhatsAppNumber || !ReceivesNotices())
        {
            WhatsAppNumber = whatsAppNumber;
            LinkedAt = now;
            StoppedAt = null;
        }
    }

    public void Stop(DateTime now) => StoppedAt ??= now;
}
