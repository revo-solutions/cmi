using System.Collections.Concurrent;
using System.Net;
using System.Text;
using System.Text.Json;

namespace RevoSolutions.CMI.Tests.Api;

// Stands in for Expo's push service: records every push and answers each token with the outcome the test gave it.
public sealed class FakeExpoPush : HttpMessageHandler
{
    private const string Unregistered = """{"status":"error","message":"Not registered","details":{"error":"DeviceNotRegistered"}}""";

    private readonly ConcurrentQueue<SentPush> _sent = new();
    private readonly ConcurrentDictionary<string, string> _ticketTokens = new();
    private readonly ConcurrentDictionary<string, bool> _unregistered = new();

    public IReadOnlyList<SentPush> SentTo(string token) => _sent.Where(p => p.To == token).ToList();

    // Expo already knows the token is gone when the push is sent, or only says so later, in the receipt.
    public void Unregister(string token, bool onSend) => _unregistered[token] = onSend;

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));

        return request.RequestUri!.AbsolutePath.EndsWith("/getReceipts", StringComparison.Ordinal)
            ? Receipt(json.RootElement.GetProperty("ids")[0].GetString()!)
            : Send(json.RootElement[0]);
    }

    private HttpResponseMessage Send(JsonElement message)
    {
        var to = message.GetProperty("to").GetString()!;
        _sent.Enqueue(new SentPush(
            to,
            message.GetProperty("data").GetProperty("type").GetString(),
            Silent: !message.TryGetProperty("title", out _) && !message.TryGetProperty("body", out _)));

        if (_unregistered.TryGetValue(to, out var onSend) && onSend)
        {
            return Json($$"""{"data":[{{Unregistered}}]}""");
        }

        var ticketId = Guid.NewGuid().ToString();
        _ticketTokens[ticketId] = to;

        return Json($$"""{"data":[{"status":"ok","id":"{{ticketId}}"}]}""");
    }

    private HttpResponseMessage Receipt(string ticketId)
    {
        var receipt = _unregistered.ContainsKey(_ticketTokens[ticketId]) ? Unregistered : """{"status":"ok"}""";

        return Json($$"""{"data":{"{{ticketId}}":""" + receipt + "}}");
    }

    private static HttpResponseMessage Json(string body) =>
        new(HttpStatusCode.OK) { Content = new StringContent(body, Encoding.UTF8, "application/json") };
}

public sealed record SentPush(string To, string? Type, bool Silent);
