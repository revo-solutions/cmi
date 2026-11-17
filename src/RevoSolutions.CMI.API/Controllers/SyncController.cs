using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using RevoSolutions.CMI.Domain.Models;
using RevoSolutions.CMI.Domain.Services;

namespace RevoSolutions.CMI.API.Controllers;

// Every action answers 409 to a device that is no longer the account's active one.
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/sync")]
public class SyncController : ControllerBase
{
    private readonly SyncService _syncService;

    public SyncController(SyncService syncService)
    {
        _syncService = syncService;
    }

    // Every record of the account, for a device signing in.
    [HttpGet]
    public async Task<ActionResult<SyncModel>> Download() => await _syncService.Download();

    // A batch from the outgoing queue: each record is kept only if it is newer than what the server has.
    [HttpPost]
    public async Task<NoContentResult> Upload(SyncModel changes)
    {
        await _syncService.Upload(changes);

        return NoContent();
    }

    // The device's sign of life, with its platform, time zone and push token. An upload also counts as contact.
    [HttpPost("heartbeat")]
    public async Task<NoContentResult> Heartbeat(HeartbeatModel heartbeat)
    {
        await _syncService.Heartbeat(heartbeat);

        return NoContent();
    }
}
