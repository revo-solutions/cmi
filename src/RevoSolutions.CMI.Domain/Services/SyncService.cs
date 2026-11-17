using RevoSolutions.CMI.Domain.Authorization;
using RevoSolutions.CMI.Domain.Core.Contracts.Repositories;
using RevoSolutions.CMI.Domain.Core.Contracts.UnitOfWork;
using RevoSolutions.CMI.Domain.Core.Exceptions;
using RevoSolutions.CMI.Domain.Entities;
using RevoSolutions.CMI.Domain.Mapping;
using RevoSolutions.CMI.Domain.Models;

namespace RevoSolutions.CMI.Domain.Services;

// One active device per account, so there is no merging: each record keeps its latest change by the device's clock.
public class SyncService
{
    private readonly IRepository<Account> _accounts;
    private readonly IRepository<Medication> _medications;
    private readonly IRepository<DoseRecord> _doseRecords;
    private readonly IRepository<Contact> _contacts;
    private readonly SyncMapper _mapper;
    private readonly IUnitOfWork _unitOfWork;
    private readonly ICurrentAccount _current;

    public SyncService(
        IRepository<Account> accounts,
        IRepository<Medication> medications,
        IRepository<DoseRecord> doseRecords,
        IRepository<Contact> contacts,
        SyncMapper mapper,
        IUnitOfWork unitOfWork,
        ICurrentAccount current)
    {
        _accounts = accounts;
        _medications = medications;
        _doseRecords = doseRecords;
        _contacts = contacts;
        _mapper = mapper;
        _unitOfWork = unitOfWork;
        _current = current;
    }

    public async Task<SyncModel> Download()
    {
        var account = await ActiveAccount();

        return new SyncModel
        {
            Profile = SyncMapper.ToProfile(account),
            Medications = (await _medications.Get(m => m.AccountId == account.Id)).Select(_mapper.ToModel).ToList(),
            DoseRecords = (await _doseRecords.Get(d => d.AccountId == account.Id)).Select(_mapper.ToModel).ToList(),
            Contacts = (await _contacts.Get(c => c.AccountId == account.Id)).Select(_mapper.ToModel).ToList(),
        };
    }

    public async Task Heartbeat(HeartbeatModel heartbeat)
    {
        var account = await ActiveAccount();
        account.RecordHeartbeat(heartbeat);

        await _unitOfWork.CommitAsync();
    }

    public async Task Upload(SyncModel changes)
    {
        var account = await ActiveAccount();
        account.MarkSeen();

        if (changes.Profile is { } profile && account.IsProfileOlderThan(profile.UpdatedAt))
        {
            account.UpdateProfile(profile);
        }

        var medications = Latest(changes.Medications, m => m.Id, m => m.UpdatedAt);
        var storedMedications = await Stored(_medications, account.Id, medications.Select(m => m.Id));
        foreach (var change in medications)
        {
            if (!storedMedications.TryGetValue(change.Id, out var medication))
            {
                await _medications.Add(Medication.Create(account.Id, change));
            }
            else if (medication.IsOlderThan(change.UpdatedAt))
            {
                medication.Update(change);
            }
        }

        var doseRecords = Latest(changes.DoseRecords, d => d.Id, d => d.UpdatedAt);
        await EnsureMedicationsExist(account.Id, doseRecords.Select(d => d.MedicationId).Except(medications.Select(m => m.Id)));
        var storedDoseRecords = await Stored(_doseRecords, account.Id, doseRecords.Select(d => d.Id));
        foreach (var change in doseRecords)
        {
            if (!storedDoseRecords.TryGetValue(change.Id, out var record))
            {
                await _doseRecords.Add(DoseRecord.Create(account.Id, change));
            }
            else if (record.IsOlderThan(change.UpdatedAt))
            {
                record.Update(change);
            }
        }

        var contacts = Latest(changes.Contacts, c => c.Id, c => c.UpdatedAt);
        var storedContacts = await Stored(_contacts, account.Id, contacts.Select(c => c.Id));
        foreach (var change in contacts)
        {
            if (!storedContacts.TryGetValue(change.Id, out var contact))
            {
                if (!change.Deleted)
                {
                    await _contacts.Add(Contact.Create(account.Id, change));
                }
            }
            else if (contact.IsOlderThan(change.UpdatedAt))
            {
                if (change.Deleted)
                {
                    _contacts.Remove(contact);
                    await StopSharing(account.Id);
                }
                else
                {
                    contact.Update(change);
                }
            }
        }

        await _unitOfWork.CommitAsync();
    }

    // A record queued, changed and queued again can arrive twice in one batch.
    private static List<T> Latest<T>(IEnumerable<T> changes, Func<T, Guid> id, Func<T, DateTimeOffset> updatedAt) =>
        changes.GroupBy(id).Select(g => g.MaxBy(updatedAt)!).ToList();

    private static async Task<Dictionary<Guid, TEntity>> Stored<TEntity>(IRepository<TEntity> repository, Guid accountId, IEnumerable<Guid> ids)
        where TEntity : SyncedEntityBase
    {
        var idArray = ids.ToArray();
        var stored = idArray.Length == 0 ? [] : await repository.Get(e => idArray.Contains(e.Id));

        if (stored.Any(e => e.AccountId != accountId))
        {
            throw new DomainForbiddenException("A record belongs to another account.");
        }

        return stored.ToDictionary(e => e.Id);
    }

    private async Task EnsureMedicationsExist(Guid accountId, IEnumerable<Guid> ids)
    {
        var idArray = ids.Distinct().ToArray();
        if (idArray.Length == 0)
        {
            return;
        }

        var found = await _medications.Get(m => m.AccountId == accountId && idArray.Contains(m.Id));
        if (found.Count != idArray.Length)
        {
            throw new DomainException("A dose record refers to a medication that was never synced.");
        }
    }

    // Revoking the contact revokes what was shared with them, so a new contact starts seeing nothing. The device's
    // UpdatedAt is left alone: the device makes the same change and syncs it.
    private async Task StopSharing(Guid accountId)
    {
        foreach (var medication in await _medications.Get(m => m.AccountId == accountId && m.SharedWithContact))
        {
            medication.SharedWithContact = false;
        }
    }

    // A device that lost the active spot gets a conflict, and the app offers to make it active again.
    private async Task<Account> ActiveAccount()
    {
        var account = await _accounts.FirstOrDefault(a => a.Id == _current.AccountId)
            ?? throw new DomainNotFoundException($"{nameof(Account)} not found.");

        if (account.ActiveDeviceId != _current.DeviceId)
        {
            throw new DomainConflictException("The account is active on another device.");
        }

        return account;
    }
}
