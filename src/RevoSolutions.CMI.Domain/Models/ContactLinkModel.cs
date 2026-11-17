namespace RevoSolutions.CMI.Domain.Models;

// The app puts Code in the prefilled WhatsApp message to the app's number, as a word of its own.
public record ContactLinkModel(string Code, bool Linked, bool Stopped);
