using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Entities;

// The trusted contact. Removing it deletes the row: the contact's data must leave the server.
public class Contact : SyncedEntityBase
{
    public string Name { get; set; } = string.Empty;

    public string Phone { get; set; } = string.Empty;

    public Relationship Relationship { get; set; }

    public static Contact Create(Guid accountId, ContactModel model)
    {
        var contact = new Contact { Id = model.Id, AccountId = accountId };
        contact.Update(model);

        return contact;
    }

    public void Update(ContactModel model)
    {
        Name = model.Name;
        Phone = model.Phone;
        Relationship = model.Relationship;
        UpdatedAt = model.UpdatedAt.UtcDateTime;
    }
}
