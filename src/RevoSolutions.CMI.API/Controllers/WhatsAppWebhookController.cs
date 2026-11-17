using Asp.Versioning;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RevoSolutions.CMI.Anticorruption.WhatsApp;

namespace RevoSolutions.CMI.API.Controllers;

// Meta's webhook: the URL registered in the app's dashboard, subscribed to the "messages" field.
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/webhooks/whatsapp")]
[AllowAnonymous]
public class WhatsAppWebhookController : ControllerBase
{
    private readonly WhatsAppWebhook _webhook;

    public WhatsAppWebhookController(WhatsAppWebhook webhook)
    {
        _webhook = webhook;
    }

    [HttpGet]
    [ProducesResponseType(StatusCodes.Status403Forbidden)]
    public ActionResult<string> Verify(
        [FromQuery(Name = "hub.mode")] string? mode,
        [FromQuery(Name = "hub.verify_token")] string? verifyToken,
        [FromQuery(Name = "hub.challenge")] string? challenge) =>
        _webhook.Verify(mode, verifyToken, challenge) is { } answer ? Content(answer, "text/plain") : StatusCode(StatusCodes.Status403Forbidden);

    // The signature covers the exact bytes Meta sent, so the body is read raw.
    [HttpPost]
    [ProducesResponseType(StatusCodes.Status200OK)]
    [ProducesResponseType(StatusCodes.Status401Unauthorized)]
    public async Task<ActionResult> Receive(CancellationToken cancellationToken)
    {
        using var buffer = new MemoryStream();
        await Request.Body.CopyToAsync(buffer, cancellationToken);
        var body = buffer.ToArray();

        if (!_webhook.IsSigned(body, Request.Headers["X-Hub-Signature-256"]))
        {
            return Unauthorized();
        }

        await _webhook.Receive(body, cancellationToken);

        return Ok();
    }
}
