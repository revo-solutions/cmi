using System.Net.Http.Json;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Logging;

namespace RevoSolutions.CMI.Anticorruption.WhatsApp;

// Meta's Cloud API, called directly. Logs never carry phone numbers or message text.
public sealed partial class WhatsAppClient
{
    private const string Language = "pt_BR";

    private readonly HttpClient _http;
    private readonly WhatsAppSettings _settings;
    private readonly ILogger<WhatsAppClient> _logger;

    public WhatsAppClient(HttpClient http, WhatsAppSettings settings, ILogger<WhatsAppClient> logger)
    {
        _http = http;
        _settings = settings;
        _logger = logger;
    }

    // A message outside a conversation the person opened: only an approved template may go, and it is paid for.
    public Task SendTemplate(string to, string template, IReadOnlyList<string> parameters, CancellationToken cancellationToken = default) =>
        Post(
            template,
            new
            {
                messaging_product = "whatsapp",
                to,
                type = "template",
                template = new
                {
                    name = template,
                    language = new { code = Language },
                    components = new[]
                    {
                        new { type = "body", parameters = parameters.Select(p => new { type = "text", text = Clean(p) }).ToArray() },
                    },
                },
            },
            cancellationToken);

    // Free text, allowed only within 24 hours of a message from that number.
    public Task SendText(string to, string body, CancellationToken cancellationToken = default) =>
        Post("text", new { messaging_product = "whatsapp", to, type = "text", text = new { body } }, cancellationToken);

    private async Task Post(string what, object message, CancellationToken cancellationToken)
    {
        if (string.IsNullOrEmpty(_settings.AccessToken))
        {
            if (_logger.IsEnabled(LogLevel.Information))
            {
                _logger.LogInformation("WhatsApp isn't configured; the {What} message was not sent.", what);
            }

            return;
        }

        using var response = await _http.PostAsJsonAsync("messages", message, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            // Meta's error says which parameter or template it refused.
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"WhatsApp refused the {what} message ({(int)response.StatusCode}): {error}", null, response.StatusCode);
        }
    }

    // Template values may not hold line breaks, tabs or more than four spaces in a row.
    private static string Clean(string value) => Whitespace().Replace(value, " ").Trim();

    [GeneratedRegex(@"\s+")]
    private static partial Regex Whitespace();
}
