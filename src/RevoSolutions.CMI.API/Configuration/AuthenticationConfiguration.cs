using System.Text;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.IdentityModel.Tokens;
using RevoSolutions.CMI.API.Authentication;

namespace RevoSolutions.CMI.API.Configuration;

public static class AuthenticationConfiguration
{
    public static IServiceCollection AddAuthenticationConfiguration(this IServiceCollection services, IConfiguration configuration)
    {
        var jwt = configuration.GetSection("Jwt").Get<JwtSettings>() ?? new JwtSettings();

        // HS256 needs a 256-bit key; refusing to start beats issuing tokens anyone could forge.
        if (Encoding.UTF8.GetByteCount(jwt.SigningKey) < 32)
        {
            throw new InvalidOperationException(
                "Jwt:SigningKey must be at least 32 bytes. Set it with user secrets or the Jwt__SigningKey environment variable.");
        }

        services.AddSingleton(jwt);
        services.AddSingleton(configuration.GetSection("SocialLogin").Get<SocialLoginSettings>() ?? new SocialLoginSettings());
        services.AddSingleton<ISocialTokenValidator, SocialTokenValidator>();
        services.AddScoped<AccountService>();

        services
            .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
            .AddJwtBearer(options =>
            {
                options.MapInboundClaims = false;
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidIssuer = jwt.Issuer,
                    ValidAudience = jwt.Audience,
                    IssuerSigningKey = jwt.Key,
                    ClockSkew = TimeSpan.FromSeconds(30),
                };
            });

        // Every endpoint requires a signed-in account unless marked [AllowAnonymous].
        services.AddAuthorizationBuilder()
            .SetFallbackPolicy(new AuthorizationPolicyBuilder().RequireAuthenticatedUser().Build());

        return services;
    }
}
