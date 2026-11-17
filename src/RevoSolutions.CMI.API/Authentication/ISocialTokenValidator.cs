using RevoSolutions.CMI.Domain.Enumerators;

namespace RevoSolutions.CMI.API.Authentication;

// An interface so tests can sign in without Google or Apple.
public interface ISocialTokenValidator
{
    // Null when the token is not a valid ID token from that provider for this app.
    Task<SocialIdentity?> Validate(LoginProvider provider, string idToken, CancellationToken cancellationToken = default);
}

public record SocialIdentity(string Subject, string? Email);
