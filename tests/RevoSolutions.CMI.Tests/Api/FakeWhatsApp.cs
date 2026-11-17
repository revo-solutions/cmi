using System.Collections.Concurrent;
using System.Net;
using System.Text.Json;

namespace RevoSolutions.CMI.Tests.Api;

// Stands in for Meta's Cloud API: records every message the API sends and accepts it, unless told to refuse a number.
public sealed class FakeWhatsApp : HttpMessageHandler
{
    private readonly ConcurrentQueue<SentMessage> _sent = new();
    private readonly ConcurrentDictionary<string, int> _attempts = new();
    private readonly ConcurrentDictionary<string, HttpStatusCode> _refused = new();

    public IReadOnlyList<SentMessage> SentTo(string number) => _sent.Where(m => m.To == number).ToList();

    // Every call for the number, refused ones included.
    public int AttemptsTo(string number) => _attempts.GetValueOrDefault(number);

    // Meta answers the number's messages with this status until Accept.
    public void Refuse(string number, HttpStatusCode status) => _refused[number] = status;

    public void Accept(string number) => _refused.TryRemove(number, out _);

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        using var json = JsonDocument.Parse(await request.Content!.ReadAsStringAsync(cancellationToken));
        var root = json.RootElement;
        var to = root.GetProperty("to").GetString()!;
        var id = $"wamid.{Guid.NewGuid():N}";

        _attempts.AddOrUpdate(to, 1, (_, count) => count + 1);
        if (_refused.TryGetValue(to, out var status))
        {
            return new HttpResponseMessage(status) { Content = new StringContent("""{"error":{"code":132001}}""") };
        }

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
