using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Extensions.Logging;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Services;

namespace RevoSolutions.CMI.Anticorruption.WhatsApp;

// Translates Meta's webhook calls: text messages go to the link rules, and delivery statuses to the notices.
public sealed class WhatsAppWebhook
{
    private const string SignaturePrefix = "sha256=";

    private static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);

    private readonly WhatsAppSettings _settings;
    private readonly ContactLinkService _links;
    private readonly WhatsAppClient _client;
    private readonly IRepository<Notice> _notices;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ILogger<WhatsAppWebhook> _logger;

    public WhatsAppWebhook(
        WhatsAppSettings settings,
        ContactLinkService links,
        WhatsAppClient client,
        IRepository<Notice> notices,
        IUnitOfWork unitOfWork,
        ILogger<WhatsAppWebhook> logger)
    {
        _settings = settings;
        _links = links;
        _client = client;
        _notices = notices;
        _unitOfWork = unitOfWork;
        _logger = logger;
    }

    // Meta's one-off check when the webhook URL is registered: echo the challenge if the token is ours.
    public string? Verify(string? mode, string? verifyToken, string? challenge) =>
        mode == "subscribe" && !string.IsNullOrEmpty(_settings.VerifyToken) && verifyToken == _settings.VerifyToken ? challenge : null;

    // X-Hub-Signature-256: the HMAC-SHA256 of the raw body with the app secret.
    public bool IsSigned(byte[] body, string? signature)
    {
        if (string.IsNullOrEmpty(_settings.AppSecret) || signature is null || !signature.StartsWith(SignaturePrefix, StringComparison.Ordinal))
        {
            return false;
        }

        var expected = Convert.ToHexStringLower(HMACSHA256.HashData(Encoding.UTF8.GetBytes(_settings.AppSecret), body));

        return CryptographicOperations.FixedTimeEquals(
            Encoding.ASCII.GetBytes(expected),
            Encoding.ASCII.GetBytes(signature[SignaturePrefix.Length..].ToLowerInvariant()));
    }

    // Meta retries a call that fails, so everything here is safe to run twice; a reply sent twice costs nothing.
    public async Task Receive(byte[] body, CancellationToken cancellationToken = default)
    {
        var payload = JsonSerializer.Deserialize<Payload>(body, Json);
        var values = payload?.Entry?.SelectMany(entry => entry.Changes ?? []).Where(change => change.Field == "messages").Select(change => change.Value) ?? [];

        foreach (var value in values.OfType<Value>())
        {
            foreach (var message in value.Messages ?? [])
            {
                if (message is { Type: "text", Text.Body: { } text })
                {
                    var reply = await _links.Receive(message.From, text, DateTime.UtcNow);
                    await Reply(message.From, reply, cancellationToken);
                }
            }

            foreach (var status in value.Statuses ?? [])
            {
                await UpdateDelivery(status);
            }
        }

        await _unitOfWork.CommitAsync();
    }

    // Statuses of the free-text replies match no notice and are dropped.
    private async Task UpdateDelivery(DeliveryStatus status)
    {
        NoticeStatus? delivery = status.Status switch
        {
            "sent" => NoticeStatus.Sent,
            "delivered" => NoticeStatus.Delivered,
            "read" => NoticeStatus.Read,
            "failed" => NoticeStatus.Failed,
            _ => null,
        };

        if (delivery == NoticeStatus.Failed && _logger.IsEnabled(LogLevel.Warning))
        {
            _logger.LogWarning(
                "WhatsApp couldn't deliver message {MessageId}: error {Errors}.",
                status.Id,
                string.Join(", ", status.Errors?.Select(e => e.Code) ?? []));
        }

        if (delivery is { } update && status.Id is not null && await _notices.FirstOrDefault(n => n.MessageId == status.Id) is { } notice)
        {
            notice.UpdateDelivery(update);
        }
    }

    // What the message asked for is already done; a refused reply must not make Meta resend the call for days.
    private async Task Reply(string to, string text, CancellationToken cancellationToken)
    {
        try
        {
            await _client.SendText(to, text, cancellationToken);
        }
        catch (HttpRequestException exception)
        {
            _logger.LogWarning(exception, "The WhatsApp reply was not sent.");
        }
    }

    private sealed record Payload(IReadOnlyList<Entry>? Entry);

    private sealed record Entry(IReadOnlyList<Change>? Changes);

    private sealed record Change(string? Field, Value? Value);

    private sealed record Value(IReadOnlyList<Message>? Messages, IReadOnlyList<DeliveryStatus>? Statuses);

    private sealed record Message(string From, string? Type, TextBody? Text);

    private sealed record TextBody(string? Body);

    private sealed record DeliveryStatus(string? Id, string? Status, IReadOnlyList<Error>? Errors);

    private sealed record Error(int Code);
}
