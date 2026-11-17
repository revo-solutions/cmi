using RevoSolutions.CMI.Data.PostgreSql.Outbox;

namespace RevoSolutions.CMI.API.Notices;

// Delivers the outbox every few seconds, so an SOS goes out quickly.
public sealed class OutboxWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromSeconds(5);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<OutboxWorker> _logger;

    public OutboxWorker(IServiceScopeFactory scopes, ILogger<OutboxWorker> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            // An exception out of ExecuteAsync stops the host; the next tick tries again.
            try
            {
                using var scope = _scopes.CreateScope();
                await scope.ServiceProvider.GetRequiredService<OutboxProcessor>().ProcessPendingAsync(cancellationToken: stoppingToken);
            }
            catch (Exception ex) when (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Outbox processing failed.");
            }
        }
    }
}
