namespace RevoSolutions.CMI.API.Authentication;

public class SocialLoginSettings
{
    // The client IDs an ID token may be issued to: Google's web client ID that the app passes to Google Sign-In, and
    // the iOS bundle ID for Apple.
    public string[] GoogleClientIds { get; set; } = [];

    public string[] AppleClientIds { get; set; } = [];
}
