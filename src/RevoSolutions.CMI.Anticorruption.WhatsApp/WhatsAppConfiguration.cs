using System.Net.Http.Headers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using RevoSolutions.CMI.Domain.Contracts.Messaging;

namespace RevoSolutions.CMI.Anticorruption.WhatsApp;

public static class WhatsAppConfiguration
{
    public static IServiceCollection AddWhatsApp(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton(configuration.GetSection("WhatsApp").Get<WhatsAppSettings>() ?? new WhatsAppSettings());

        services.AddHttpClient<WhatsAppClient>((sp, http) =>
        {
            var settings = sp.GetRequiredService<WhatsAppSettings>();
            http.BaseAddress = new Uri($"https://graph.facebook.com/{settings.ApiVersion}/{settings.PhoneNumberId}/");
            http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", settings.AccessToken);
        });

        services.AddScoped<INoticeSender, WhatsAppNoticeSender>();
        services.AddScoped<WhatsAppWebhook>();

        return services;
    }
}
