using RevoSolutions.CMI.Domain.Services;

namespace RevoSolutions.CMI.API.Notices;

// Checks the time-based notice rules every minute.
public sealed class NoticeWorker : BackgroundService
{
    private static readonly TimeSpan Interval = TimeSpan.FromMinutes(1);

    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<NoticeWorker> _logger;

    public NoticeWorker(IServiceScopeFactory scopes, ILogger<NoticeWorker> logger)
    {
        _scopes = scopes;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(Interval);

        do
        {
            await CheckAll(stoppingToken);
        }
        while (await timer.WaitForNextTickAsync(stoppingToken));
    }

    // An exception out of ExecuteAsync stops the host, so every failure is logged and the next tick tries again.
    private async Task CheckAll(CancellationToken stoppingToken)
    {
        var now = DateTime.UtcNow;

        try
        {
            IReadOnlyList<Guid> accountIds;
            using (var scope = _scopes.CreateScope())
            {
                accountIds = await scope.ServiceProvider.GetRequiredService<NoticeService>().AccountsToCheck();
            }

            foreach (var accountId in accountIds)
            {
                stoppingToken.ThrowIfCancellationRequested();

                // A scope per account, so one that fails leaves nothing tracked for the next.
                using var scope = _scopes.CreateScope();
                try
                {
                    await scope.ServiceProvider.GetRequiredService<NoticeService>().Check(accountId, now);
                }
                catch (Exception ex) when (ex is not OperationCanceledException)
                {
                    _logger.LogError(ex, "Notice rules failed for account {AccountId}.", accountId.ToString());
                }
            }
        }
        catch (Exception ex) when (ex is not OperationCanceledException)
        {
            _logger.LogError(ex, "Notice rules failed.");
        }
    }
}
