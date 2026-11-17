using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using RevoSolutions.CMI.Domain.Models;
using RevoSolutions.CMI.Domain.Services;

namespace RevoSolutions.CMI.API.Controllers;

[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/contact")]
public class ContactController : ControllerBase
{
    private readonly ContactLinkService _links;

    public ContactController(ContactLinkService links)
    {
        _links = links;
    }

    // The trusted contact's link code and whether they linked up or answered PARAR. 404 until the contact is synced.
    [HttpGet("link")]
    public async Task<ActionResult<ContactLinkModel>> Link() => await _links.Get();
}
