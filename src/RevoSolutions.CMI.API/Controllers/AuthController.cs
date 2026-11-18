using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RevoSolutions.CMI.API.Authentication;
using RevoSolutions.CMI.API.Models;

namespace RevoSolutions.CMI.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/auth")]
[AllowAnonymous]
public class AuthController : ControllerBase
{
    private readonly AccountService _accountService;

    public AuthController(AccountService accountService)
    {
        _accountService = accountService;
    }

    [HttpPost("login")]
    public async Task<ActionResult<TokenResponse>> Login(LoginRequest request)
    {
        var tokens = await _accountService.Login(request.Provider, request.IdToken, request.DeviceId);

        return tokens is null ? Unauthorized(new ErrorResponse("Invalid ID token.")) : tokens;
    }

    [HttpPost("dev-login")]
    public async Task<ActionResult<TokenResponse>> DevLogin(
        DevLoginRequest request, [FromServices] IWebHostEnvironment environment, [FromServices] IConfiguration configuration)
    {
        if (!environment.IsDevelopment() || !configuration.GetValue<bool>("DevLogin:Enabled"))
        {
            return NotFound();
        }

        return await _accountService.DevLogin(request.DeviceId);
    }

    [HttpPost("refresh")]
    public async Task<ActionResult<TokenResponse>> Refresh(RefreshRequest request)
    {
        var tokens = await _accountService.Refresh(request.RefreshToken);

        return tokens is null ? Unauthorized(new ErrorResponse("Invalid or expired refresh token.")) : tokens;
    }

    [HttpPost("logout")]
    public async Task<NoContentResult> Logout(RefreshRequest request)
    {
        await _accountService.Logout(request.RefreshToken);

        return NoContent();
    }
}
