using RevoSolutions.CMI.Domain.Authorization;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Core.Exceptions;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Services;

// The family member links up by sending the contact's code from WhatsApp; that message is the opt-in Meta requires.
// PARAR stops every notice to that number.
public class ContactLinkService
{
    private const string StopWord = "PARAR";

    private readonly IRepository<Contact> _contacts;
    private readonly IRepository<Account> _accounts;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentAccount _currentAccount;

    public ContactLinkService(IRepository<Contact> contacts, IRepository<Account> accounts, IUnitOfWork unitOfWork, ICurrentAccount currentAccount)
    {
        _contacts = contacts;
        _accounts = accounts;
        _unitOfWork = unitOfWork;
        _currentAccount = currentAccount;
    }

    public async Task<ContactLinkModel> Get()
    {
        var accountId = _currentAccount.AccountId;
        var contact = await _contacts.FirstOrDefault(c => c.AccountId == accountId)
            ?? throw new DomainNotFoundException("The trusted contact hasn't reached the server yet.");

        return new ContactLinkModel(contact.LinkCode, contact.LinkedAt is not null, contact.StoppedAt is not null);
    }

    // A message someone sent to the app's WhatsApp number. Returns the reply, which is free inside the 24 hours the
    // message opened.
    public async Task<string> Receive(string from, string text, DateTime now)
    {
        var words = text.Split((char[]?)null, StringSplitOptions.RemoveEmptyEntries)
            .Select(word => new string(word.Where(char.IsLetterOrDigit).ToArray()).ToUpperInvariant())
            .ToList();

        if (words is [StopWord])
        {
            foreach (var linked in await _contacts.Get(c => c.WhatsAppNumber == from))
            {
                linked.Stop(now);
            }

            await _unitOfWork.CommitAsync();
            return "Pronto, você não vai mais receber avisos do Central Melhor Idade. Para voltar a receber, envie de novo a mensagem com o código que aparece no app.";
        }

        var codes = words.Where(word => word.Length == Contact.LinkCodeLength).ToList();
        var contact = codes.Count == 0 ? null : await _contacts.FirstOrDefault(c => codes.Contains(c.LinkCode));
        if (contact is null)
        {
            return await _contacts.FirstOrDefault(c => c.WhatsAppNumber == from && c.LinkedAt != null && c.StoppedAt == null) is null
                ? "Não encontramos esse código. Confira o código que aparece no app Central Melhor Idade e envie de novo."
                : "Este número só envia avisos do Central Melhor Idade e não lê respostas. Para deixar de receber os avisos, responda PARAR.";
        }

        contact.Link(from, now);
        await _unitOfWork.CommitAsync();

        // Linked even without Premium, so the notices start as soon as the person subscribes; the reply says so rather
        // than promise notices that won't come.
        var account = await _accounts.FirstOrDefault(a => a.Id == contact.AccountId);
        var notices = $"os avisos {NoticeMessageBuilder.Subject(contact.Relationship, account?.Name, account?.Sex)} no Central Melhor Idade: " +
            "o resumo diário, as doses sem confirmação e lembretes como o de aniversário.";

        return account?.IsPremium(now) == true
            ? $"Pronto! Você vai receber aqui {notices} Para deixar de receber, responda PARAR."
            : $"Pronto, seu número está vinculado para receber {notices} Eles começam a chegar aqui quando o Premium for " +
                "ativado no app. Para deixar de receber, responda PARAR.";
    }
}
