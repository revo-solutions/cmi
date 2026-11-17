using System.Net.Http.Headers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;

namespace RevoSolutions.CMI.Anticorruption.RevenueCat;

public static class RevenueCatConfiguration
{
    public static IServiceCollection AddRevenueCat(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(configuration.GetSection("RevenueCat").Get<RevenueCatSettings>() ?? new RevenueCatSettings());

        services.AddHttpClient<RevenueCatClient>((sp, http) =>
        {
            http.BaseAddress = new Uri("https://api.revenuecat.com/v1/");
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", sp.GetRequiredService<RevenueCatSettings>().ApiKey);
        });

        services.AddScoped<RevenueCatWebhook>();

        return services;
    }
}
