using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;

namespace RevoSolutions.CMI.Tests.Api;

// Stands in for Meta's Cloud API: records every message the API sends and accepts it.
public sealed class FakeWhatsApp : HttpMessageHandler
{
    private readonly ConcurrentQueue<SentMessage> _sent = new();

    public IReadOnlyList<SentMessage> SentTo(string number) => _sent.Where(m => m.To == number).ToList();

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
        var root = json.RootElement;
        var to = root.GetProperty("to").GetString()!;
        var id = $"wamid.{Guid.NewGuid():N}";

        _sent.Enqueue(root.GetProperty("type").GetString() == "template"
            ? new SentMessage(
                id,
                to,
                root.GetProperty("template").GetProperty("name").GetString(),
                root.GetProperty("template").GetProperty("components")[0].GetProperty("parameters").EnumerateArray()
                    .Select(p => p.GetProperty("text").GetString()!)
                    .ToList(),
                null)
            : new SentMessage(id, to, null, [], root.GetProperty("text").GetProperty("body").GetString()));

        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent($$"""{"messaging_product":"whatsapp","messages":[{"id":"{{id}}"}]}"""),
        };
    }
}

// A template message has Template and Parameters; a free-text reply has Text. Id is the one the API got back.
public sealed record SentMessage(string Id, string To, string? Template, IReadOnlyList<string> Parameters, string? Text);
