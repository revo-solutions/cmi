using System.Net.Http.Json;
using RevoSolutions.CMI.Domain.Contracts.Push;

namespace RevoSolutions.CMI.Anticorruption.ExpoPush;

// Expo's push service, which forwards to Google and Apple. Errors never carry the push token.
public sealed class ExpoPushClient : IPushSender
{
    private const string DeviceNotRegistered = "DeviceNotRegistered";

    private readonly HttpClient _http;

    public ExpoPushClient(HttpClient http)
    {
        _http = http;
    }

    // Data only, with no title or body, so nothing shows on the phone: the app's background task answers it with a
    // heartbeat. High priority wakes a sleeping Android phone; contentAvailable wakes the app on iOS.
    public async Task<string?> Ping(string pushToken, CancellationToken cancellationToken = default)
    {
        var message = new { to = pushToken, data = new { type = "ping" }, priority = "high", contentAvailable = true };
        var tickets = await Post<SendResponse>("send", new[] { message }, cancellationToken);
        var ticket = tickets.Data is [var first, ..] ? first : throw new HttpRequestException("Expo returned no push ticket.");

        return ticket switch
        {
            { Status: "ok", Id: { } id } => id,
            { Details.Error: DeviceNotRegistered } => null,
            _ => throw new HttpRequestException($"Expo refused the ping: {ticket.Details?.Error ?? ticket.Message}"),
        };
    }

    public async Task<bool> IsUnregistered(string ticketId, CancellationToken cancellationToken = default)
    {
        var receipts = await Post<ReceiptsResponse>("getReceipts", new { ids = new[] { ticketId } }, cancellationToken);

        return receipts.Data?.GetValueOrDefault(ticketId)?.Details?.Error == DeviceNotRegistered;
    }

    private async Task<T> Post<T>(string path, object body, CancellationToken cancellationToken)
    {
        using var response = await _http.PostAsJsonAsync(path, body, cancellationToken);
        if (!response.IsSuccessStatusCode)
        {
            var error = await response.Content.ReadAsStringAsync(cancellationToken);
            throw new HttpRequestException($"Expo refused the {path} request ({(int)response.StatusCode}): {error}", null, response.StatusCode);
        }

        return await response.Content.ReadFromJsonAsync<T>(cancellationToken) ?? throw new HttpRequestException($"Expo's {path} response was empty.");
    }

    private sealed record SendResponse(IReadOnlyList<Ticket>? Data);

    private sealed record ReceiptsResponse(IReadOnlyDictionary<string, Ticket>? Data);

    private sealed record Ticket(string? Status, string? Id, string? Message, Details? Details);

    private sealed record Details(string? Error);
}
