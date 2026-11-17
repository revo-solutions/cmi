using Microsoft.EntityFrameworkCore;
using RevoSolutions.CMI.API.Notices;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
using RevoSolutions.CMI.Data.PostgreSql.Interceptors;
using RevoSolutions.CMI.Data.PostgreSql.Outbox;
using RevoSolutions.CMI.Data.PostgreSql.Repositories;
using RevoSolutions.CMI.Data.PostgreSql.UnitOfWork;
using RevoSolutions.CMI.Domain.Authorization;
using RevoSolutions.CMI.Domain.Contracts.Messaging;
using RevoSolutions.CMI.Domain.Core.Contracts.Events;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Events;
using RevoSolutions.CMI.Domain.Handlers;
using RevoSolutions.CMI.Domain.Mapping;
using RevoSolutions.CMI.Domain.Models;
using RevoSolutions.CMI.Domain.Services;

namespace RevoSolutions.CMI.API.Configuration;

public static class DependencyInjection
{
    public static IServiceCollection AddIoC(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddHttpContextAccessor();
        services.AddScoped<ICurrentAccount, CurrentAccount>();

        services.AddSingleton<DomainEventToOutboxInterceptor>();

        services.AddDbContext<CmiDbContext>((sp, options) =>
            options
                .UseNpgsql(configuration.GetConnectionString("CmiConnection"))
                .AddInterceptors(sp.GetRequiredService<DomainEventToOutboxInterceptor>()));

        services.AddScoped(typeof(IRepository<>), typeof(Repository<>));
        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<OutboxProcessor>();

        services.AddSingleton<SyncMapper>();
        services.AddScoped<SyncService>();

        services.AddSingleton(configuration.GetSection("Notices").Get<NoticeSettings>() ?? new NoticeSettings());
        services.AddScoped<NoticeService>();
        services.AddScoped<IDomainEventHandler<NoticeCreatedDomainEvent>, SendNoticeHandler>();
        services.AddSingleton<INoticeSender, LoggingNoticeSender>();
        services.AddHostedService<NoticeWorker>();
        services.AddHostedService<OutboxWorker>();

        return services;
    }
}
