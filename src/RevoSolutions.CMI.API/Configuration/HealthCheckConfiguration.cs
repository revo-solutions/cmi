using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace RevoSolutions.CMI.API.Configuration;

public static class HealthCheckConfiguration
{
    public static IServiceCollection AddHealthCheckConfiguration(this IServiceCollection services, IConfiguration configuration)
    {
        var connectionString = configuration.GetConnectionString("CmiConnection") ?? string.Empty;

        services.AddHealthChecks()
                .AddNpgSql(connectionString, tags: new[] { "sql-status" })
                .AddCheck("api-status", () => HealthCheckResult.Healthy(), tags: new[] { "api-status" });

        return services;
    }
}
