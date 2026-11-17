namespace RevoSolutions.CMI.Anticorruption.ExpoPush;

// The "ExpoPush" configuration section. The secret goes in user secrets or the environment, never in appsettings.
public class ExpoPushSettings
{
    // Needed only once "enhanced push security" is turned on in Expo's dashboard; without it Expo takes any request.
    public string AccessToken { get; set; } = string.Empty;
}
