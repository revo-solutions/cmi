namespace RevoSolutions.CMI.Domain.Models;

// The notice rules' numbers (docs/escopo.md, "Celular sem conexão e abandono do app"). These defaults are the only place
// they are written; the "Notices" configuration section overrides them.
public class NoticeSettings
{
    public TimeSpan MissedDoseAfter { get; set; } = TimeSpan.FromHours(1);

    // A missed dose is notified only if the device was in touch within this long before the deadline.
    public TimeSpan RecentContact { get; set; } = TimeSpan.FromHours(6);

    public int MissedDoseNoticesPerDay { get; set; } = 3;

    public TimeOnly SummaryTime { get; set; } = new(20, 0);

    public TimeOnly BirthdayTime { get; set; } = new(9, 0);

    public TimeSpan NoContactAndroid { get; set; } = TimeSpan.FromHours(12);

    public TimeSpan NoContactIos { get; set; } = TimeSpan.FromHours(24);

    // How long a ping has to bring a heartbeat before the family hears the phone is silent.
    public TimeSpan PingWait { get; set; } = TimeSpan.FromMinutes(30);

    public int AbandonmentDays { get; set; } = 3;
}
