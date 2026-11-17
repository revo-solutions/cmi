using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using RevoSolutions.CMI.API.Authentication;
using RevoSolutions.CMI.Domain.Authorization;

namespace RevoSolutions.CMI.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/account")]
public class AccountController : ControllerBase
{
    private readonly AccountService _accountService;
    private readonly ICurrentAccount _current;

    public AccountController(AccountService accountService, ICurrentAccount current)
    {
        _accountService = accountService;
        _current = current;
    }

    // Makes the calling device the active one again after another device signed in.
    [HttpPut("active-device")]
    public async Task<NoContentResult> ActivateDevice()
    {
        await _accountService.ActivateDevice(_current.AccountId, _current.DeviceId);

        return NoContent();
    }

    // Deletes the account and everything stored with it.
    [HttpDelete]
    public async Task<NoContentResult> Delete()
    {
        await _accountService.Delete(_current.AccountId);

        return NoContent();
    }
}
