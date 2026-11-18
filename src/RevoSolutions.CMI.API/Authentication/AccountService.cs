using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;
using RevoSolutions.CMI.API.Models;
using RevoSolutions.CMI.Data.PostgreSql.Authentication;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
using RevoSolutions.CMI.Domain.Core.Exceptions;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Enumerators;

namespace RevoSolutions.CMI.API.Authentication;

public class AccountService
{
    public const string DeviceIdClaim = "device_id";

    private static readonly TimeSpan RotationGracePeriod = TimeSpan.FromSeconds(30);

    private readonly CmiDbContext _dbContext;
    private readonly ISocialTokenValidator _validator;
    private readonly JwtSettings _jwt;

    public AccountService(CmiDbContext dbContext, ISocialTokenValidator validator, JwtSettings jwt)
    {
        _dbContext = dbContext;
        _validator = validator;
        _jwt = jwt;
    }

    // The first login creates the account. Every login makes this device the active one, so the previous device's next
    // sync is refused; its session stays valid, so it can take the account back.
    public async Task<TokenResponse?> Login(LoginProvider provider, string idToken, Guid deviceId)
    {
        RequireDeviceId(deviceId);

        if (provider == LoginProvider.Development)
        {
            return null;
        }

        var identity = await _validator.Validate(provider, idToken);
        return identity is null ? null : await LoginAccount(provider, identity, deviceId);
    }

    public Task<TokenResponse> DevLogin(Guid deviceId)
    {
        RequireDeviceId(deviceId);
        return LoginAccount(LoginProvider.Development, new SocialIdentity(deviceId.ToString("N"), null), deviceId);
    }

    private async Task<TokenResponse> LoginAccount(LoginProvider provider, SocialIdentity identity, Guid deviceId)
    {
        var account = await _dbContext.Accounts.FirstOrDefaultAsync(a => a.Provider == provider && a.Subject == identity.Subject);
        if (account is null)
        {
            account = Account.Create(provider, identity.Subject, identity.Email, deviceId);
            _dbContext.Accounts.Add(account);
        }
        else
        {
            account.Email = identity.Email ?? account.Email;
            account.ActivateDevice(deviceId);
        }

        return await IssueTokens(account.Id, deviceId);
    }

    private static void RequireDeviceId(Guid deviceId)
    {
        if (deviceId == Guid.Empty)
        {
            throw new DomainException("DeviceId is required.");
        }
    }

    public async Task<TokenResponse?> Refresh(string refreshToken)
    {
        var hash = Hash(refreshToken);
        var stored = await _dbContext.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash);
        var now = DateTime.UtcNow;

        if (stored is null || stored.ExpiresAt <= now)
        {
            return null;
        }

        // Tokens rotate on every refresh, so a revoked one, or one rotated before the grace period, coming back means
        // it was stolen: end every session. Within the grace period it is a retry whose response never arrived (the
        // connection dropped), and it gets a new token.
        if (stored.RevokedAt is not null || stored.RotatedAt < now - RotationGracePeriod)
        {
            await RevokeAll(stored.AccountId);
            return null;
        }

        stored.RotatedAt ??= now;

        return await IssueTokens(stored.AccountId, stored.DeviceId);
    }

    public async Task Logout(string refreshToken)
    {
        var hash = Hash(refreshToken);
        var stored = await _dbContext.RefreshTokens.FirstOrDefaultAsync(t => t.TokenHash == hash && t.RevokedAt == null);

        if (stored is not null)
        {
            stored.RevokedAt = DateTime.UtcNow;
            await _dbContext.SaveChangesAsync();
        }
    }

    // "Usar neste celular": the device that lost the active spot takes it back.
    public async Task ActivateDevice(Guid accountId, Guid deviceId)
    {
        var account = await FindAccount(accountId);
        account.ActivateDevice(deviceId);

        await _dbContext.SaveChangesAsync();
    }

    // Everything of the account cascades with it in the database, refresh tokens included. Access tokens already issued
    // stop working on the next call that looks the account up.
    public async Task Delete(Guid accountId)
    {
        _dbContext.Accounts.Remove(await FindAccount(accountId));

        await _dbContext.SaveChangesAsync();
    }

    private static string Hash(string refreshToken) =>
        Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(refreshToken)));

    private async Task<Account> FindAccount(Guid accountId) =>
        await _dbContext.Accounts.FirstOrDefaultAsync(a => a.Id == accountId)
            ?? throw new DomainNotFoundException($"{nameof(Account)} not found.");

    private async Task RevokeAll(Guid accountId)
    {
        var active = await _dbContext.RefreshTokens
            .Where(t => t.AccountId == accountId && t.RevokedAt == null)
            .ToListAsync();

        foreach (var token in active)
        {
            token.RevokedAt = DateTime.UtcNow;
        }

        await _dbContext.SaveChangesAsync();
    }

    private async Task<TokenResponse> IssueTokens(Guid accountId, Guid deviceId)
    {
        var now = DateTime.UtcNow;
        var refreshToken = Base64UrlEncoder.Encode(RandomNumberGenerator.GetBytes(32));

        _dbContext.RefreshTokens.Add(new RefreshToken
        {
            AccountId = accountId,
            DeviceId = deviceId,
            TokenHash = Hash(refreshToken),
            CreatedAt = now,
            ExpiresAt = now.AddDays(_jwt.RefreshTokenDays),
        });

        await _dbContext.SaveChangesAsync();

        var accessToken = new JsonWebTokenHandler().CreateToken(new SecurityTokenDescriptor
        {
            Issuer = _jwt.Issuer,
            Audience = _jwt.Audience,
            Expires = now.AddMinutes(_jwt.AccessTokenMinutes),
            SigningCredentials = new SigningCredentials(_jwt.Key, SecurityAlgorithms.HmacSha256),
            Claims = new Dictionary<string, object>
            {
                [JwtRegisteredClaimNames.Sub] = accountId.ToString(),
                [DeviceIdClaim] = deviceId.ToString(),
            },
        });

        return new TokenResponse(accessToken, _jwt.AccessTokenMinutes * 60, refreshToken);
    }
}
