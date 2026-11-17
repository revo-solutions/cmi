using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RevoSolutions.CMI.Anticorruption.RevenueCat;

namespace RevoSolutions.CMI.API.Controllers;

// RevenueCat's webhook, with the Authorization header set in its dashboard.
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/webhooks/revenuecat")]
[AllowAnonymous]
public class RevenueCatWebhookController : ControllerBase
{
    private readonly RevenueCatWebhook _webhook;

    public RevenueCatWebhookController(RevenueCatWebhook webhook)
    {
        _webhook = webhook;
    }

    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> Receive(CancellationToken cancellationToken)
    {
        if (!_webhook.IsAuthorized(Request.Headers.Authorization))
        {
            return Unauthorized();
        }

        using var buffer = new MemoryStream();
        await Request.Body.CopyToAsync(buffer, cancellationToken);
        await _webhook.Receive(buffer.ToArray(), cancellationToken);

        return Ok();
    }
}
