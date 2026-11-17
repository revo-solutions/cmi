namespace RevoSolutions.CMI.Anticorruption.RevenueCat;

// The "RevenueCat" configuration section. The secrets go in user secrets or the environment, never in appsettings.
public class RevenueCatSettings
{
    // A v1 secret API key, for reading a customer's entitlements.
    public string ApiKey { get; set; } = string.Empty;

    // The Authorization header value set on the webhook in RevenueCat's dashboard. Without it every call is refused.
    // Not starting with "Bearer ", which the JWT handler would try to read as the app's token.
    public string WebhookAuthorization { get; set; } = string.Empty;

    // The entitlement that is Premium, as named in RevenueCat's dashboard.
    public string EntitlementId { get; set; } = "premium";
}
