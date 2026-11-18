namespace RevoSolutions.CMI.Domain.Enumerators;

// Why a help request didn't go out over WhatsApp, so the app can say what would make it work.
public enum SosNotSentReason
{
    NoPremium,

    // No contact, or one that hasn't sent the link code yet.
    NotLinked,

    // The contact answered PARAR.
    Stopped,
}
