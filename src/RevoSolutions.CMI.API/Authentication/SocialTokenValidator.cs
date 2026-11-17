using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;
using RevoSolutions.CMI.Domain.Enumerators;

namespace RevoSolutions.CMI.API.Authentication;

// Checks the ID token against the provider's published signing keys, which the configuration managers cache and
// refresh on their own.
public sealed class SocialTokenValidator : ISocialTokenValidator
{
    private static readonly JsonWebTokenHandler Handler = new();

    private static readonly string[] GoogleIssuers = ["https://accounts.google.com", "accounts.google.com"];
    private static readonly string[] AppleIssuers = ["https://appleid.apple.com"];

    private readonly ConfigurationManager<OpenIdConnectConfiguration> _google = Discover("https://accounts.google.com/.well-known/openid-configuration");
    private readonly ConfigurationManager<OpenIdConnectConfiguration> _apple = Discover("https://appleid.apple.com/.well-known/openid-configuration");
    private readonly SocialLoginSettings _settings;
    private readonly ILogger<SocialTokenValidator> _logger;

    public SocialTokenValidator(SocialLoginSettings settings, ILogger<SocialTokenValidator> logger)
    {
        _settings = settings;
        _logger = logger;
    }

    public async Task<SocialIdentity?> Validate(LoginProvider provider, string idToken, CancellationToken cancellationToken = default)
    {
        var (discovery, issuers, audiences) = provider switch
        {
            LoginProvider.Google => (_google, GoogleIssuers, _settings.GoogleClientIds),
            LoginProvider.Apple => (_apple, AppleIssuers, _settings.AppleClientIds),
            _ => (null, [], []),
        };

        if (discovery is null || string.IsNullOrEmpty(idToken))
        {
            return null;
        }

        var configuration = await discovery.GetConfigurationAsync(cancellationToken);
        var result = await Handler.ValidateTokenAsync(idToken, new TokenValidationParameters
        {
            ValidIssuers = issuers,
            ValidAudiences = audiences,
            IssuerSigningKeys = configuration.SigningKeys,
        });

        var claims = result.Claims;
        if (!result.IsValid || !claims.TryGetValue(JwtRegisteredClaimNames.Sub, out var sub) || sub is not string { Length: > 0 } subject)
        {
            if (_logger.IsEnabled(LogLevel.Information))
            {
                _logger.LogInformation(result.Exception, "Rejected a {Provider} ID token.", provider);
            }

            return null;
        }

        return new SocialIdentity(subject, claims.TryGetValue(JwtRegisteredClaimNames.Email, out var email) ? email as string : null);
    }

    private static ConfigurationManager<OpenIdConnectConfiguration> Discover(string url) =>
        new(url, new OpenIdConnectConfigurationRetriever());
}
