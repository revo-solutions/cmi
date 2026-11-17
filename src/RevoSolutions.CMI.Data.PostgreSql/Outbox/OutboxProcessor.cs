using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
using RevoSolutions.CMI.Domain.Core.Contracts.Events;

namespace RevoSolutions.CMI.Data.PostgreSql.Outbox;

/// <summary>
/// Pulls unprocessed outbox rows and dispatches them to registered
/// <see cref="IDomainEventHandler{TDomainEvent}"/> instances. Intended to be
/// driven by a hosted background service or an external scheduler.
/// </summary>
public sealed class OutboxProcessor
{
    // A failing message waits twice as long before each new try and is given up after MaxAttempts, about an hour and a
    // half later. So one that can never go out neither retries forever nor holds back the messages behind it.
    public const int MaxAttempts = 10;

    private static readonly TimeSpan FirstRetry = TimeSpan.FromSeconds(10);

    private readonly CmiDbContext _context;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<OutboxProcessor> _logger;

    public OutboxProcessor(CmiDbContext context, IServiceProvider serviceProvider, ILogger<OutboxProcessor> logger)
    {
        _context = context;
        _serviceProvider = serviceProvider;
        _logger = logger;
    }

    public async Task<int> ProcessPendingAsync(int batchSize = 50, CancellationToken cancellationToken = default)
    {
        var now = DateTime.UtcNow;
        var pending = await _context.OutboxMessages
            .Where(m => m.ProcessedOn == null && m.Attempts < MaxAttempts && (m.NextAttemptAt == null || m.NextAttemptAt <= now))
            .OrderBy(m => m.OccurredOn)
            .Take(batchSize)
            .ToListAsync(cancellationToken).ConfigureAwait(false);

        foreach (var message in pending)
        {
            try
            {
                var eventType = Type.GetType(message.Type)
                    ?? throw new InvalidOperationException($"Unknown domain event type '{message.Type}'.");

                var domainEvent = (IDomainEvent?)JsonSerializer.Deserialize(message.Content, eventType)
                    ?? throw new InvalidOperationException($"Failed to deserialize outbox message '{message.Id}'.");

                var handlerType = typeof(IDomainEventHandler<>).MakeGenericType(eventType);
                var handlers = _serviceProvider.GetServices(handlerType);

                foreach (var handler in handlers)
                {
                    if (handler is null)
                    {
                        continue;
                    }

                    var task = (Task)handlerType.GetMethod(nameof(IDomainEventHandler<IDomainEvent>.HandleAsync))!
                        .Invoke(handler, new object[] { domainEvent, cancellationToken })!;

                    await task.ConfigureAwait(false);
                }

                message.ProcessedOn = DateTime.UtcNow;
                message.Error = null;
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to process outbox message {OutboxId}.", message.Id);
                message.Error = ex.Message;
                message.Attempts++;

                if (message.Attempts < MaxAttempts)
                {
                    message.NextAttemptAt = now + (FirstRetry * Math.Pow(2, message.Attempts - 1));
                }
                else
                {
                    _logger.LogError("Gave up on outbox message {OutboxId} after {Attempts} attempts.", message.Id, message.Attempts);
                }
            }
        }

        await _context.SaveChangesAsync(cancellationToken).ConfigureAwait(false);
        return pending.Count;
    }
}
