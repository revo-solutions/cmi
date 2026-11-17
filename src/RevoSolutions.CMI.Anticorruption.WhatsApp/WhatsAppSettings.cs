namespace RevoSolutions.CMI.Anticorruption.WhatsApp;

// The "WhatsApp" configuration section, from the Meta app and the WhatsApp Business account. The secrets go in user
// secrets or the environment, never in appsettings.
public class WhatsAppSettings
{
    public string ApiVersion { get; set; } = "v24.0";

    // The id Meta gives the app's phone number, not the number itself.
    public string PhoneNumberId { get; set; } = string.Empty;

    // A system user's permanent token. Without it nothing is sent, only logged: that is how local runs work.
    public string AccessToken { get; set; } = string.Empty;

    // Signs every webhook call; a call that doesn't match it is refused.
    public string AppSecret { get; set; } = string.Empty;

    // Chosen when registering the webhook in Meta's dashboard, which sends it back once to confirm the URL.
    public string VerifyToken { get; set; } = string.Empty;
}
