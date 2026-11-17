using System.Text;
using Microsoft.IdentityModel.Tokens;

namespace RevoSolutions.CMI.API.Authentication;

public class JwtSettings
{
    public string Issuer { get; set; } = string.Empty;

    public string Audience { get; set; } = string.Empty;

    public string SigningKey { get; set; } = string.Empty;

    public int AccessTokenMinutes { get; set; }

    public int RefreshTokenDays { get; set; }

    public SymmetricSecurityKey Key => new(Encoding.UTF8.GetBytes(SigningKey));
}
