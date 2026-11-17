using System.Text.Json.Serialization;
using Asp.Versioning;
using FluentValidation;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc.Controllers;
using Microsoft.AspNetCore.OpenApi;
using Microsoft.OpenApi;
using RevoSolutions.CMI.API.Configuration;
using RevoSolutions.CMI.API.Filters;
using RevoSolutions.CMI.Domain.Validators;
using Scalar.AspNetCore;
using SharpGrip.FluentValidation.AutoValidation.Mvc.Extensions;

var builder = WebApplication.CreateBuilder(args);

builder.AddObservability();

builder.Services.AddIoC(builder.Configuration);
builder.Services.AddAuthenticationConfiguration(builder.Configuration);
builder.Services.AddHealthCheckConfiguration(builder.Configuration);

builder.Services.AddValidatorsFromAssemblyContaining<SyncModelValidator>();
builder.Services.AddFluentValidationAutoValidation();

// Enums travel by name and numbers only as numbers (the web default also accepts "1.5", which the OpenAPI
// document then types as number | string). Controllers serialize with the MVC JSON options, while the OpenAPI
// document reads the minimal-API ones, so both need the same settings.
builder.Services
    .AddControllers(options => options.Filters.Add<GlobalExceptionFilter>())
    .AddJsonOptions(options =>
    {
        options.JsonSerializerOptions.Converters.Add(new JsonStringEnumConverter());
        options.JsonSerializerOptions.NumberHandling = JsonNumberHandling.Strict;
    });
builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
    options.SerializerOptions.NumberHandling = JsonNumberHandling.Strict;
});

builder.Services
    .AddApiVersioning(options =>
    {
        options.DefaultApiVersion = new ApiVersion(1, 0);
        options.AssumeDefaultVersionWhenUnspecified = true;
        options.ReportApiVersions = true;
    })
    .AddMvc()
    .AddApiExplorer(options =>
    {
        options.GroupNameFormat = "'v'VVV";
        options.SubstituteApiVersionInUrl = true;
    });

// The app's generated client names its functions after operationId; without one, generators fall back to the URL.
builder.Services.AddOpenApi(options => options.AddOperationTransformer((operation, context, _) =>
{
    if (context.Description.ActionDescriptor is ControllerActionDescriptor action)
    {
        operation.OperationId = action.ControllerName + action.ActionName;
    }

    return Task.CompletedTask;
}));

// Declares the bearer token so Scalar asks for it once and sends it with every request; anonymous endpoints opt out.
builder.Services.Configure<OpenApiOptions>("v1", options => options
    .AddDocumentTransformer((document, _, _) =>
    {
        document.Components ??= new OpenApiComponents();
        document.Components.SecuritySchemes ??= new Dictionary<string, IOpenApiSecurityScheme>();
        document.Components.SecuritySchemes[JwtBearerDefaults.AuthenticationScheme] = new OpenApiSecurityScheme
        {
            Type = SecuritySchemeType.Http,
            Scheme = "bearer",
            BearerFormat = "JWT",
        };
        document.Security = [new OpenApiSecurityRequirement { [new OpenApiSecuritySchemeReference(JwtBearerDefaults.AuthenticationScheme, document)] = [] }];

        return Task.CompletedTask;
    })
    .AddOperationTransformer((operation, context, _) =>
    {
        if (context.Description.ActionDescriptor.EndpointMetadata.OfType<IAllowAnonymous>().Any())
        {
            operation.Security = [];
        }

        return Task.CompletedTask;
    }));

var app = builder.Build();

if (app.Environment.IsDevelopment() || app.Environment.IsStaging())
{
    app.UseDeveloperExceptionPage();
    app.MapOpenApi().AllowAnonymous();
    app.MapScalarApiReference(options => options
        .AddPreferredSecuritySchemes(JwtBearerDefaults.AuthenticationScheme)
        .EnablePersistentAuthentication()).AllowAnonymous();
}

// No HTTPS redirection or CORS: TLS ends at the host's ingress, the only client is the app, and the Android emulator
// reaches a local API over plain HTTP.
app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();
app.MapHealthChecks("/health", new() { Predicate = check => check.Tags.Contains("api-status") }).AllowAnonymous();
app.MapHealthChecks("/health/database", new() { Predicate = check => check.Tags.Contains("sql-status") }).AllowAnonymous();

app.Run();

namespace RevoSolutions.CMI.API
{
    public partial class Program
    {
    }
}
