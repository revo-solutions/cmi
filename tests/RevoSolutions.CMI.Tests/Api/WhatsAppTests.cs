using System.Net;
using System.Net.Http.Json;
using FluentAssertions;
using RevoSolutions.CMI.Domain.Enumerators;
using RevoSolutions.CMI.Domain.Models;
using Xunit;

namespace RevoSolutions.CMI.Tests.Api;

[Collection(ApiCollection.Name)]
public class WhatsAppTests
{
    private readonly CmiApiFactory _factory;

    public WhatsAppTests(CmiApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Meta_confirms_the_webhook_with_our_verify_token_only()
    {
        var client = _factory.CreateClient();
        var url = "/api/v1/webhooks/whatsapp?hub.mode=subscribe&hub.challenge=1158201444&hub.verify_token=";

        var confirmed = await client.GetAsync(url + CmiApiFactory.WhatsAppSettings.VerifyToken);
        confirmed.StatusCode.Should().Be(HttpStatusCode.OK);
        (await confirmed.Content.ReadAsStringAsync()).Should().Be("1158201444");

        (await client.GetAsync(url + "guess")).StatusCode.Should().Be(HttpStatusCode.Forbidden);
    }

    [Fact]
    public async Task A_webhook_call_without_meta_signature_is_refused()
    {
        const string Body = """{"object":"whatsapp_business_account","entry":[]}""";

        (await _factory.PostWhatsApp(Body, null)).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await _factory.PostWhatsApp(Body, CmiApiFactory.Sign(Body + " "))).StatusCode.Should().Be(HttpStatusCode.Unauthorized);
        (await _factory.PostWhatsApp(Body, CmiApiFactory.Sign(Body))).StatusCode.Should().Be(HttpStatusCode.OK);
    }

    [Fact]
    public async Task Sending_the_code_links_the_family_member_and_parar_stops_until_the_code_comes_again()
    {
        var phone = await PersonWithContact("Maria", Relationship.Mother);
        var whatsApp = CmiApiFactory.NewWhatsAppNumber();
        var link = await Link(phone);
        link.Should().BeEquivalentTo(new { Linked = false, Stopped = false });
        link.Code.Should().HaveLength(8);

        await Receive(whatsApp, $"Olá! Quero receber os avisos da Maria pelo Central Melhor Idade. Código: {link.Code}");
        (await Link(phone)).Should().BeEquivalentTo(new { link.Code, Linked = true, Stopped = false });
        LastReply(whatsApp).Should().Contain("os avisos da sua mãe, Maria").And.Contain("PARAR");

        await Receive(whatsApp, " parar! ");
        (await Link(phone)).Should().BeEquivalentTo(new { Linked = true, Stopped = true });
        LastReply(whatsApp).Should().Contain("não vai mais receber");

        await Receive(whatsApp, link.Code.ToLowerInvariant());
        (await Link(phone)).Should().BeEquivalentTo(new { Linked = true, Stopped = false });
    }

    [Fact]
    public async Task An_unknown_code_or_a_stray_message_gets_a_helpful_reply()
    {
        var whatsApp = CmiApiFactory.NewWhatsAppNumber();

        await Receive(whatsApp, "Código: ZZZZ2222");
        LastReply(whatsApp).Should().StartWith("Não encontramos esse código");

        var phone = await PersonWithContact(null, Relationship.Friend);
        await Receive(whatsApp, (await Link(phone)).Code);
        LastReply(whatsApp).Should().Contain("os avisos da pessoa que você acompanha");

        await Receive(whatsApp, "Obrigado!");
        LastReply(whatsApp).Should().Contain("responda PARAR");
    }

    [Fact]
    public async Task A_new_phone_for_the_contact_needs_a_new_link()
    {
        var contact = new ContactModel(Guid.NewGuid(), "Ana", "+5511999990000", Relationship.Mother, false, DateTimeOffset.UtcNow.AddMinutes(-5));
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());
        await Sync(phone, new SyncModel { Contacts = [contact] });
        var before = await Link(phone);
        await Receive(CmiApiFactory.NewWhatsAppNumber(), before.Code);

        await Sync(phone, new SyncModel { Contacts = [contact with { Name = "Ana Paula", UpdatedAt = DateTimeOffset.UtcNow.AddMinutes(-4) }] });
        (await Link(phone)).Should().BeEquivalentTo(new { before.Code, Linked = true });

        await Sync(phone, new SyncModel { Contacts = [contact with { Phone = "+5511988887777", UpdatedAt = DateTimeOffset.UtcNow }] });
        var after = await Link(phone);
        after.Linked.Should().BeFalse();
        after.Code.Should().NotBe(before.Code);
    }

    [Fact]
    public async Task There_is_no_link_code_before_the_contact_reaches_the_server()
    {
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());

        (await phone.GetAsync("/api/v1/contact/link")).StatusCode.Should().Be(HttpStatusCode.NotFound);
    }

    private async Task<HttpClient> PersonWithContact(string? name, Relationship relationship)
    {
        var phone = await _factory.SignedInClient(CmiApiFactory.NewSubject(), Guid.NewGuid());
        await Sync(phone, new SyncModel
        {
            Profile = new ProfileModel(name, null, [], null, null, null, null, DateTimeOffset.UtcNow),
            Contacts = [new ContactModel(Guid.NewGuid(), "Ana", "+5511999990000", relationship, false, DateTimeOffset.UtcNow)],
        });

        return phone;
    }

    private static async Task Sync(HttpClient phone, SyncModel changes) =>
        (await phone.PostAsJsonAsync("/api/v1/sync", changes, CmiApiFactory.Json)).EnsureSuccessStatusCode();

    private static async Task<ContactLinkModel> Link(HttpClient phone) =>
        (await phone.GetFromJsonAsync<ContactLinkModel>("/api/v1/contact/link", CmiApiFactory.Json))!;

    private async Task Receive(string from, string text) => (await _factory.ReceiveWhatsApp(from, text)).EnsureSuccessStatusCode();

    private string LastReply(string whatsApp) => _factory.WhatsApp.SentTo(whatsApp).Last(m => m.Text is not null).Text!;
}
