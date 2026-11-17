using System.Security.Claims;
using Microsoft.IdentityModel.JsonWebTokens;
using RevoSolutions.CMI.API.Authentication;
using RevoSolutions.CMI.Domain.Authorization;

namespace RevoSolutions.CMI.API.Configuration;

public sealed class CurrentAccount : ICurrentAccount
{
    private readonly IHttpContextAccessor _accessor;

    public CurrentAccount(IHttpContextAccessor accessor)
    {
        _accessor = accessor;
    }

    public Guid AccountId => Guid.Parse(RequireClaim(JwtRegisteredClaimNames.Sub));

    public Guid DeviceId => Guid.Parse(RequireClaim(AccountService.DeviceIdClaim));

    private string RequireClaim(string type) =>
        _accessor.HttpContext?.User.FindFirstValue(type)
            ?? throw new InvalidOperationException($"No signed-in account: the '{type}' claim is missing.");
}
