namespace RevoSolutions.CMI.API.Models;

public record TokenResponse(string AccessToken, int ExpiresIn, string RefreshToken);
