namespace RevoSolutions.CMI.Domain.Authorization;

public interface ICurrentAccount
{
    Guid AccountId { get; }

    // The device the access token was issued to.
    Guid DeviceId { get; }
}
