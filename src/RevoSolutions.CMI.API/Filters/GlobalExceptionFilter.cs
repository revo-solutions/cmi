using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;
using RevoSolutions.CMI.API.Models;
using RevoSolutions.CMI.Domain.Core.Exceptions;

namespace RevoSolutions.CMI.API.Filters;

public class GlobalExceptionFilter : IAsyncExceptionFilter
{
    private readonly ILogger<GlobalExceptionFilter> _logger;

    public GlobalExceptionFilter(ILogger<GlobalExceptionFilter> logger)
    {
        _logger = logger;
    }

    public Task OnExceptionAsync(ExceptionContext context)
    {
        context.ExceptionHandled = true;

        var logDescription = $"{context.HttpContext.Request.Protocol} {context.HttpContext.Request.Method} {context.HttpContext.Request.Path}";

        switch (context.Exception)
        {
            case DomainNotFoundException notFound:
                _logger.LogInformation(notFound, logDescription);
                context.Result = new JsonResult(new ErrorResponse(notFound.Message))
                {
                    StatusCode = StatusCodes.Status404NotFound,
                };
                break;

            case DomainForbiddenException forbidden:
                _logger.LogWarning(forbidden, logDescription);
                context.Result = new JsonResult(new ErrorResponse(forbidden.Message))
                {
                    StatusCode = StatusCodes.Status403Forbidden,
                };
                break;

            case DomainConflictException conflict:
                _logger.LogInformation(conflict, logDescription);
                context.Result = new JsonResult(new ErrorResponse(conflict.Message))
                {
                    StatusCode = StatusCodes.Status409Conflict,
                };
                break;

            case DomainException domain:
                _logger.LogWarning(domain, logDescription);
                context.Result = new JsonResult(new ErrorResponse(domain.Message))
                {
                    StatusCode = StatusCodes.Status400BadRequest,
                };
                break;

            default:
                _logger.LogError(context.Exception, logDescription);
                context.Result = new JsonResult(new ErrorResponse("Unfortunately an error occurred while processing your request."))
                {
                    StatusCode = StatusCodes.Status500InternalServerError,
                };
                break;
        }

        return Task.CompletedTask;
    }
}
