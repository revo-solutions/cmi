using System.Net.Http.Headers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RevoSolutions.CMI.Domain.Contracts.Push;

namespace RevoSolutions.CMI.Anticorruption.ExpoPush;

public static class ExpoPushConfiguration
{
    public static IServiceCollection AddExpoPush(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(configuration.GetSection("ExpoPush").Get<ExpoPushSettings>() ?? new ExpoPushSettings());

        services.AddHttpClient<IPushSender, ExpoPushClient>((sp, http) =>
        {
            http.BaseAddress = new Uri("https://exp.host/--/api/v2/push/");

            var accessToken = sp.GetRequiredService<ExpoPushSettings>().AccessToken;
            if (!string.IsNullOrEmpty(accessToken))
            {
                http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);
            }
        });

        return services;
    }
}
