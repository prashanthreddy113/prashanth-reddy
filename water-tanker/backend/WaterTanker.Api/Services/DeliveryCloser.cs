namespace WaterTanker.Api.Services;

/// <summary>Background timer that closes deliveries whose device went quiet (see Delivery:IdleCloseMinutes).</summary>
public class DeliveryCloser : BackgroundService
{
    private readonly IServiceScopeFactory _scopes;
    private readonly ILogger<DeliveryCloser> _log;
    private readonly TimeSpan _idle;

    public DeliveryCloser(IServiceScopeFactory scopes, IConfiguration config, ILogger<DeliveryCloser> log)
    {
        _scopes = scopes;
        _log = log;
        _idle = TimeSpan.FromMinutes(config.GetValue("Delivery:IdleCloseMinutes", 3.0));
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        using var timer = new PeriodicTimer(TimeSpan.FromSeconds(30));
        while (await timer.WaitForNextTickAsync(stoppingToken))
        {
            try
            {
                using var scope = _scopes.CreateScope();
                var svc = scope.ServiceProvider.GetRequiredService<DeliveryService>();
                var closed = await svc.CloseIdleAsync(_idle, stoppingToken);
                if (closed > 0) _log.LogInformation("Closed {Count} idle deliveries", closed);
            }
            catch (OperationCanceledException) when (stoppingToken.IsCancellationRequested) { }
            catch (Exception ex)
            {
                _log.LogError(ex, "Idle delivery sweep failed");
            }
        }
    }
}
