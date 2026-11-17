namespace RevoSolutions.CMI.Domain.Enumerators;

public enum NoticeKind
{
    MissedDose,
    DailySummary,
    NoContact,

    // The silent phone's push no longer reaches the app: uninstalled, or notifications turned off.
    Uninstalled,
    Paused,
    Birthday,
}
