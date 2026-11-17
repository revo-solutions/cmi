using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using RevoSolutions.CMI.Data.PostgreSql.Contexts;
using RevoSolutions.CMI.Data.PostgreSql.Outbox;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

[Collection(ApiCollection.Name)]
public class SosTests
{
    private static readonly DateTimeOffset RequestedAt = new(2026, 11, 17, 14, 32, 10, TimeSpan.FromHours(-3));

    private readonly CmiApiFactory _factory;

    public SosTests(CmiApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task A_premium_sos_goes_to_the_linked_contact_once_and_the_app_follows_its_status()
    {
        var person = await Person(premium: true);
        var sos = new SosModel(Guid.NewGuid(), RequestedAt);

        (await Send(person, sos)).Should().Be(new SosStatusModel(sos.Id, null));
        (await Send(person, sos)).Should().Be(new SosStatusModel(sos.Id, null));
        await _factory.ProcessOutbox();

        var message = _factory.WhatsApp.SentTo(person.WhatsApp).Should().ContainSingle(m => m.Template != null).Subject;
        message.Should().BeEquivalentTo(new
        {
            Template = "pedido_de_ajuda",
            Parameters = new[] { "da sua mãe, Maria", "17/11 às 14:32" },
        });
        (await Status(person, sos.Id)).Should().Be(NoticeStatus.Sent);

        // Meta may report the statuses out of order.
        await _factory.ReceiveWhatsAppStatus(message.Id, "read");
        await _factory.ReceiveWhatsAppStatus(message.Id, "delivered");
        (await Status(person, sos.Id)).Should().Be(NoticeStatus.Read);
    }

    [Fact]
    public async Task A_failed_delivery_shows_as_failed()
    {
        var person = await Person(premium: true);
        var sos = new SosModel(Guid.NewGuid(), RequestedAt);
        await Send(person, sos);
        await _factory.ProcessOutbox();

        var message = _factory.WhatsApp.SentTo(person.WhatsApp).Single(m => m.Template != null);
        await _factory.ReceiveWhatsAppStatus(message.Id, "failed");

        (await Status(person, sos.Id)).Should().Be(NoticeStatus.Failed);
    }

    [Fact]
    public async Task An_sos_whatsapp_refuses_fails_at_once_and_is_not_tried_again()
    {
        var person = await Person(premium: true);
        _factory.WhatsApp.Refuse(person.WhatsApp, HttpStatusCode.BadRequest);
        var sos = new SosModel(Guid.NewGuid(), RequestedAt);
        await Send(person, sos);

        await _factory.ProcessOutbox();
        await _factory.ProcessOutbox();

        (await Status(person, sos.Id)).Should().Be(NoticeStatus.Failed);
        _factory.WhatsApp.AttemptsTo(person.WhatsApp).Should().Be(2, "the link reply and one try at the SOS");
    }

    [Fact]
    public async Task An_sos_that_fails_for_now_waits_to_be_tried_again()
    {
        var person = await Person(premium: true);
        _factory.WhatsApp.Refuse(person.WhatsApp, HttpStatusCode.ServiceUnavailable);
        var sos = new SosModel(Guid.NewGuid(), RequestedAt);
        await Send(person, sos);

        await _factory.ProcessOutbox();
        await _factory.ProcessOutbox();

        (await Status(person, sos.Id)).Should().BeNull();
        _factory.WhatsApp.AttemptsTo(person.WhatsApp).Should().Be(2, "the link reply and one try at the SOS");
        var message = await OutboxMessageFor(sos.Id);
        message.Attempts.Should().Be(1);
        message.NextAttemptAt.Should().BeAfter(DateTime.UtcNow);

        _factory.WhatsApp.Accept(person.WhatsApp);
        await RetryNow(message.Id);
        await _factory.ProcessOutbox();

        (await Status(person, sos.Id)).Should().Be(NoticeStatus.Sent);
    }

    [Fact]
    public async Task Without_premium_or_a_linked_contact_the_sos_is_not_sent_and_the_app_is_told()
    {
        var free = await Person(premium: false);
        var unlinked = await Person(premium: true, link: false);

        foreach (var person in new[] { free, unlinked })
        {
            var sos = new SosModel(Guid.NewGuid(), RequestedAt);
            await Send(person, sos);
            await _factory.ProcessOutbox();

            (await Status(person, sos.Id)).Should().Be(NoticeStatus.NotSent);
            _factory.WhatsApp.SentTo(person.WhatsApp).Should().NotContain(m => m.Template != null);
        }
    }

    [Fact]
    public async Task Another_accounts_sos_is_not_found()
    {
        var person = await Person(premium: true);
        var other = await Person(premium: true);
        var sos = new SosModel(Guid.NewGuid(), RequestedAt);
        await Send(person, sos);

        (await other.Phone.GetAsync($"/api/v1/sos/{sos.Id}")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private static async Task<SosStatusModel> Send(PersonSetup person, SosModel sos)
    {
        var response = await person.Phone.PostAsJsonAsync("/api/v1/sos", sos, CmiApiFactory.Json);
        response.EnsureSuccessStatusCode();

        return (await response.Content.ReadFromJsonAsync<SosStatusModel>(CmiApiFactory.Json))!;
    }

    private async Task<OutboxMessage> OutboxMessageFor(Guid sosId)
    {
        using var scope = _factory.Services.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<CmiDbContext>();
        var noticeId = await db.Set<Notice>().Where(n => n.Key.EndsWith($":{sosId}")).Select(n => n.Id).SingleAsync();

        return await db.OutboxMessages.AsNoTracking().SingleAsync(m => m.Content.Contains(noticeId.ToString()));
    }

    private async Task RetryNow(Guid outboxMessageId)
    {
        using var scope = _factory.Services.CreateScope();
        await scope.ServiceProvider.GetRequiredService<CmiDbContext>().OutboxMessages
            .Where(m => m.Id == outboxMessageId)
            .ExecuteUpdateAsync(m => m.SetProperty(x => x.NextAttemptAt, DateTime.UtcNow.AddSeconds(-1)));
    }

    private static async Task<NoticeStatus?> Status(PersonSetup person, Guid id) =>
        (await person.Phone.GetFromJsonAsync<SosStatusModel>($"/api/v1/sos/{id}", CmiApiFactory.Json))!.Status;

    // Maria, with her daughter as the trusted contact, linked up on WhatsApp unless told otherwise.
    private async Task<PersonSetup> Person(bool premium, bool link = true)
    {
        var subject = CmiApiFactory.NewSubject();
        var phone = await _factory.SignedInClient(subject, Guid.NewGuid());
        var records = new SyncModel
        {
            Profile = new ProfileModel("Maria", null, [], null, null, null, null, DateTimeOffset.UtcNow),
            Contacts = [new ContactModel(Guid.NewGuid(), "Ana", "+5511999990000", Relationship.Mother, false, DateTimeOffset.UtcNow)],
        };
        (await phone.PostAsJsonAsync("/api/v1/sync", records, CmiApiFactory.Json)).EnsureSuccessStatusCode();

        var whatsApp = CmiApiFactory.NewWhatsAppNumber();
        if (link)
        {
            var code = (await phone.GetFromJsonAsync<ContactLinkModel>("/api/v1/contact/link", CmiApiFactory.Json))!.Code;
            (await _factory.ReceiveWhatsApp(whatsApp, code)).EnsureSuccessStatusCode();
        }

        if (premium)
        {
            await _factory.SetPremium((await _factory.StoredAccount(subject)).Id, DateTimeOffset.UtcNow.AddMonths(1));
        }

        return new PersonSetup(phone, whatsApp);
    }

    private sealed record PersonSetup(HttpClient Phone, string WhatsApp);
}
