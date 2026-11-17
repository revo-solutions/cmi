using Asp.Versioning;
using Microsoft.AspNetCore.Mvc;
using RevoSolutions.CMI.Domain.Models;
using RevoSolutions.CMI.Domain.Services;

namespace RevoSolutions.CMI.API.Controllers;

// Unlike sync, a device that is no longer the active one may still ask for help.
[ApiController]
[ApiVersion("1.0")]
[Route("api/v{version:apiVersion}/sos")]
public class SosController : ControllerBase
{
    private readonly SosService _sos;

    public SosController(SosService sos)
    {
        _sos = sos;
    }

    [HttpPost]
    public async Task<ActionResult<SosStatusModel>> Send(SosModel request) => await _sos.Request(request);

    // The app polls it until the status says sent, delivered, read, failed or not sent.
    [HttpGet("{id:guid}")]
    public async Task<ActionResult<SosStatusModel>> Get(Guid id) => await _sos.Get(id);
}
