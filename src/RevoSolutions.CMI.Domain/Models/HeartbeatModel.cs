using RevoSolutions.CMI.Domain.Enumerators;

namespace RevoSolutions.CMI.Domain.Models;

// Sent when the app opens and periodically in the background. PushToken is null while the app has none.
public record HeartbeatModel(DevicePlatform Platform, string TimeZone, string? PushToken);
