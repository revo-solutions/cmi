# RevoSolutions.CMI — working conventions

Central Melhor Idade: an Android and iOS app that helps older people keep their medication routine, find useful phone
numbers and articles, and ask a trusted family member for help. The family member gets notices over WhatsApp and never
installs the app. Single-maintainer project. React Native + Expo in `mobile/`; a .NET 10 API on PostgreSQL in `src/`,
on the same simplified DDD modular monolith as RevoSolutions.TVP. What the MVP includes and what comes after it:
`docs/escopo.md`. The stack and the reasons behind it: `docs/arquitetura.md`.

The back-end solution is `RevoSolutions.CMI.slnx`, with `Anticorruption.WhatsApp`, `Anticorruption.RevenueCat` and
`Anticorruption.ExpoPush`; the Expo app starts in `mobile/`. Build what comes next following this file, and update it
when a decision here changes or a new one is made.

## Guiding rule: less is more

This codebase is optimized for one person to hold in their head. Default to the smallest change
that solves the problem.

- **Keep implementations as simple as possible.** Fewer moving parts beats clever. Don't introduce
  layers, abstractions, generics, or patterns until a concrete need forces them. A new interface,
  base class, or indirection has to earn its place — if it has a single implementation and no second
  one in sight, inline it.
- **No redundant comments.** Don't restate what the code already says. Comment only the non-obvious
  *why* — a constraint, a trade-off, a gotcha. If a comment just narrates the next line, delete it
  and let the names carry the meaning.
- **Prefer deleting over adding.** When extending, first check whether existing code already does the
  job. Match the surrounding style instead of bringing new conventions.
- **Build only what the MVP needs.** Items under "Evoluções após o MVP" and the fall-detection spike in
  `docs/escopo.md` wait; don't lay groundwork for them.

## Product rules

The rules and their numbers live in `docs/escopo.md`; change them there first, then in code. Every number below is a
starting value: keep each one in a single setting.

- The person using the app is older and may see, hear or move with difficulty. Large controls, high contrast, text that
  scales with the system font size, and TalkBack and VoiceOver labels on every control of the main flows are
  requirements, not polish. Never fix a font size so it ignores the system setting.
- Medication reminders and recording a dose ("Tomei") work offline: reminders are local notifications scheduled on the
  device and doses are stored on the device first. Anything that needs the server (events for family notices, SOS) is
  queued and sent when there is a connection, and its status is shown, including failures.
- A dose is **Pendente**, **Registrado** or **Sem confirmação**. The history keeps when the dose was recorded and lets
  the person undo an accidental tap.
- The person chooses which medications the trusted contact sees and can revoke that access; the contact never sees a
  medication that wasn't shared. Sharing is the default and the choice is an opt-out: with a contact, a new
  medication starts shared, its form offers "Não compartilhar este remédio com a Ana" unchecked, and adding the
  contact shares the existing ones while showing the list to uncheck any. Revoking access deletes the contact's and
  the shared medications' data from the server.
- The app stands on its own: the person can use it and buy Premium with no family member linked. What is free and
  what is Premium is in `docs/escopo.md`. Rule: anything with a per-use cost is Premium. Every WhatsApp send (linking,
  routine notices, SOS over WhatsApp, birthday reminder) is Premium; free SOS calls or opens an SMS from the phone's
  own plan. The server and sync are fixed costs and stay free.
- Social login is mandatory at setup, with no passwords: Google on Android; Apple and Google on iOS (Apple requires
  its own login whenever Google's is offered). The account follows the person to any phone: medications, history,
  contact, profile and Premium. Account deletion is available in the app and deletes everything on the server.
  A dialog asks the person to type their profile name (or `EXCLUIR` if it is missing) before the final confirmation.
- Setup order: login, name (prefilled from the login; the notices use it) and birth date (required, in large day/month/year
  fields that start empty, not the system calendar), health questionnaire (one
  screen, with a visible "Pular"; a card on **Hoje** asks again days later), medications, trusted contact (optional),
  permissions. Ask for little up front; everything stays editable in the profile.
- Health conditions are stored as fixed codes (`hipertensao`, `diabetes`, ...) plus the free text of "outra", never as
  display text, so the list can grow without breaking analysis.
- Premium is bought in the app through the stores, via RevenueCat. The server trusts only RevenueCat's webhook, never
  the app, and sends nothing over WhatsApp unless Premium is active. When Premium ends, sends stop and the link
  is kept, so notices resume on resubscribing.
- The doctor report (PDF) is built on the device from SQLite and shared through the system share sheet. No clinical
  claims anywhere ("monitoramento", "controle do tratamento").
- The family member links by sending a prefilled WhatsApp message with a link code to the app's number; that message is
  the opt-in Meta requires. Replying **PARAR** stops all notices to that contact.
- The server, not the device, decides a dose is **Sem confirmação**, with the same rule on Android and iOS: no "Tomei"
  received 1 hour after the scheduled time, and only if the device was in contact in the previous 6 hours. Otherwise
  the dose only shows in the daily summary. The notice says the confirmation wasn't received, never that the dose
  wasn't taken.
- Every WhatsApp notice is a paid utility template message, so notices are kept few:
  - one daily summary at 20:00 in the person's time zone, never a notice per "Tomei";
  - at most 3 missed-dose notices per contact per day, with doses at the same time grouped into one;
  - no contact for 12 hours (24 on iOS) sends a push ping first, then a single notice;
  - 3 days in a row with no dose recorded pauses the missed-dose notices and the summary, with a single notice; they
    resume on the next "Tomei";
  - one-off notices (no contact, paused, app uninstalled) aren't repeated until the state changes;
  - a birthday reminder goes to the contact on the person's birthday ("hoje é aniversário da sua mãe, Maria"). Notices use the contact's relationship, stored from the contact's point of view.
- Fall detection is a spike outside the MVP. Don't build it into the app.

## Mobile

- React Native + Expo + TypeScript, for Android and iOS, built with EAS (development builds, not Expo Go). The main
  development device is Android; iOS is tested through TestFlight and published only after it has been tested on a
  real iPhone. `src/features/<feature>` holds a feature's screens and logic, `src/components` the shared UI, `src/api`
  the API client (generated, plus its fetch wrapper) and `src/lib` the session, sync and device helpers.
- Colors, fonts and text sizes come from `src/theme.ts`; the brand rules behind them (logo use, contrast, how text
  grows with the system font) are in `docs/marca/README.md`. Above `stackedFontScale`, side-by-side layouts stack:
  screens scroll only vertically. The app's large-text mode (`largeTextScale`, plus the stronger contrast in the brand
  guide) is a device setting, not part of the profile.
- Navigation is React Navigation (`native-stack` and `bottom-tabs`) with its static configuration in one file, so
  screens stay in `src/features/<feature>`; not `expo-router`, whose `app/` folder would be a second convention. Tabs:
  **Hoje**, **Remédios**, **Telefones** and **Artigos**; **Perfil** opens from the header. Until setup is done the
  root stack shows only its screen (`features/setup`): a group per state, chosen by `if` hooks. The setup step is a
  device setting per account, so setup resumes where it stopped; an account restored with a profile starts at the
  permissions. Each step is the form Perfil edits.
- No state library: SQLite is the source of truth, and screens read it through small hooks that query again when the
  database signals a change.
- Times and dates are typed in large fields with plus and minus buttons (hour and minute, day, month and year), never
  the system's pickers.
- Reuse the installed development client with Metro for TypeScript and UI changes. Rebuild it to test changes to
  native dependencies or configuration. Batch changes for standalone preview builds when testing without Metro,
  such as offline reminders with the app closed. EAS keeps and increments the build numbers (`appVersionSource`
  remote); don't set `versionCode` or `buildNumber` in `app.json`.
- JavaScript and content changes reach installed apps through EAS Update (`expo-updates`), with no store release. The
  runtime version is the `fingerprint` policy: a change to native dependencies or configuration gives a new runtime,
  which only a new build carries, so an update never reaches a build it doesn't fit. The fingerprint hashes files
  such as `mobile/.gitignore`, which is why `.gitattributes` keeps `mobile/` in LF. An update downloads when the app
  opens and applies at the next open; never make the app wait for it or reload by itself.
- Reminders use `expo-notifications` (daily repeating triggers, "Tomei" and "Lembrar depois" actions) and
  `expo-background-task` (the outgoing queue, the heartbeat and downloading updates), behind one TypeScript
  interface. Prefer Expo modules over bare native code; own Kotlin or Swift code goes behind that same interface, and
  only when tests on real devices prove the gain. Leaving the managed workflow needs a reason written here.
- `src/lib/reminders.ts` is that interface. `reconcileReminders` makes the scheduled daily reminders match the
  medications; call it on opening and after every change to one. A daily reminder is `dose.<medication>.<HHmm>`
  (`delivery: 'alarmClock'` on Android), a snooze `snooze.<medication>.<day>.<HHmm>`, so an action knows its dose
  without the notification's data, which Android's background task doesn't parse. "Tomei" keeps the first tap.
  At most `maxDailyReminders` (48) daily times, under iOS's 64 pending notifications. It also keeps `birthday`, the
  local greeting on the next birthday at 9:00 (the 28th outside leap years for 29 February, as the server's notice),
  scheduled again once it has rung or when the name or birth date changes.
- The server's ping (see "Push") is a data-only push, `{ "type": "ping" }` with no title or body, so nothing shows.
  The app answers it with a heartbeat from a background notification task (`expo-task-manager`; on iOS the
  `expo-notifications` plugin's `enableBackgroundRemoteNotifications`).
- SQLite (`expo-sqlite`) on the device keeps the app working offline. Every change is synced to the server through
  the outgoing queue (see `docs/arquitetura.md`, "Sincronização"): records get a UUID and an updated-at on the
  device, the last write wins, and only one device per account is active. The app saves a change and its queued
  copy in the same transaction. It retries failed batches and acknowledges only the rows that were sent.
- The device works out a dose's state on its own: **Pendente** until 1 hour after its time, **Registrado** once it
  has `taken_at` (even before it is uploaded), **Sem confirmação** after the deadline with no "Tomei". The hour is a
  constant that mirrors the server's `NoticeSettings.MissedDoseAfter` (`docs/escopo.md` keeps them one number). The
  6-hour contact rule stays on the server: it decides whether the family hears, not what the person sees, and the
  screen never says whether a notice went out.
- "Usar neste celular" after a 409 uploads queued doses for medications already on the server and uses the server's
  ID if both phones recorded the same dose. It discards the other queued changes and restores the account from
  the server; the screen warns first. A dose recorded during recovery stays in the queue if its medication exists
  on the server. Restoring the server's copy keeps a contact removed on the other phone from coming back.
  "Sair" waits for the queue to be sent, except on a blocked phone, whose queue taking the account back would discard.
- Login uses `@react-native-google-signin/google-signin` and `expo-apple-authentication`; the app exchanges the
  provider's token for the API's JWT and refresh token, kept in the system's secure storage.
  The app opens a stored session offline and serializes token rotation. First sign-in restores the account in one
  SQLite transaction. The OAuth IDs, API URL and push credentials are configured as described in `mobile/README.md`.
- Purchases use the RevenueCat SDK (`react-native-purchases`) with the account id as the app user id. The app reads
  the entitlement from the SDK only to show what is unlocked.
- Opening **SOS** with a contact asks for help over WhatsApp: a row in `sos_requests` (apart from the outbox, so a
  blocked sync doesn't hold it back) sent by `POST sos` with its id and the phone's offset, then read by
  `GET sos/{id}`. Opening it again within 5 minutes shows the same request unless it failed. The call, the SMS and
  192 are always on the screen; a `NotSent` answer leaves only them.
- The doctor report uses `expo-print` and `expo-sharing`.
- The API client is generated from the OpenAPI document with orval, as in RevoSolutions.TVP's `web/`.
- Content lives in `mobile/content/`: one Markdown file per article (frontmatter with title, theme, health-condition
  codes and date), `telefones.json` (category, name, number, whether it is an emergency number) and the Premium promo
  texts. No admin UI and no content endpoint; new content ships with EAS Update. `npm run content` turns `content/`
  into `src/content.ts`, which is committed, and CI checks it is current. Articles render a small Markdown subset
  (headings, paragraphs, lists, bold) with the app's own components, so they follow the system font and TalkBack;
  add a Markdown library only when the content needs more.
- The app is pt-BR only: write user-facing text in Portuguese and don't add an i18n layer until a second language is
  scheduled.

## Backend

### Namespaces

`RevoSolutions.CMI.{project}.{folder}` — folder names mirror namespaces, file-scoped declarations.

### Structure

- `Domain.Core` — contracts only (`IRepository`, `IUnitOfWork`, `IDomainEvent` and its handler, exceptions).
- `Domain` — entities (account, profile, medications, dose records, contact), domain services, the notice rules, validators, Mapperly mappers, domain events. Owns the
  contracts of the external systems it calls (`Contracts/Messaging`, `Contracts/Push`). No infrastructure.
- `Data.PostgreSql` — EF Core `DbContext`, repositories, Unit of Work, the outbox and its interceptor, refresh tokens,
  migrations.
- `Anticorruption.*` — one project per external system, translating it into domain terms: `WhatsApp` (Meta Cloud
  API, called directly with no intermediary: template sends and the webhook's link code, PARAR and delivery
  status), `ExpoPush` (the ping and its receipts, which tell when the push no longer reaches the app) and `RevenueCat` (the subscription
  webhook, translated into `Account.PremiumUntil`).
- `API` — controllers, sync endpoints, the WhatsApp and RevenueCat webhooks, social login, the per-minute worker and the outbox processor
  (hosted services), DI composition. Thin; delegates to domain services.
- `tests/RevoSolutions.CMI.Tests` — one test project for the solution.

### Authentication

Social login only: no passwords and no ASP.NET Core Identity. The API validates the Google or Apple ID token against
the provider's public keys, finds or creates the account, marks the device as the active one, and issues a short-lived
JWT with a rotating refresh token, the same token scheme as RevoSolutions.TVP.

- `API/Authentication/AccountService` does login, refresh, logout, "use this phone again" and account deletion. Like
  TVP's, it queries `CmiDbContext` directly, since refresh tokens live in `Data.PostgreSql`.
- `ISocialTokenValidator` exists so tests sign in with a fake; `SocialTokenValidator` is the real one. The accepted
  audiences are `SocialLogin:GoogleClientIds` (the web client ID the app passes to Google Sign-In) and
  `SocialLogin:AppleClientIds` (the iOS bundle ID). An account is one provider + subject: the same person signing in
  with Apple and then Google gets two accounts.
- Local development can use `POST auth/dev-login` in `Development` with `DevLogin:Enabled=true`. It issues a normal
  session for a test account keyed by the installation's device ID. The app shows the test sign-in button in `__DEV__`.
- The access token carries `sub` (the account) and `device_id` (a UUID the app generates once per install, sent at
  login). A refresh keeps the device. A device that is not `Account.ActiveDeviceId` gets 409 on sync; its session stays
  valid so `PUT account/active-device` can take the account back.
- Deleting the account deletes the row; every table references it with `ON DELETE CASCADE`, refresh tokens included.

### Sync

`SyncService` and `SyncModel`, one shape both ways: `POST sync` uploads a batch of changed records, `GET sync` downloads
every record of the account. Records carry a device-generated `Id` and the device's `UpdatedAt`; a change is applied
only when it is newer than the stored one, so a resent batch is harmless. The profile lives on the `Account` row and
syncs as a whole, by `ProfileUpdatedAt`. A deleted medication stays as a tombstone (`Deleted`), because dose records
point at it; a deleted contact is removed from the server. A dose record never changes which dose it is (medication,
scheduled date and time, all wall-clock); only `TakenAt` changes, and undoing "Tomei" clears it.

A medication's schedule history is its `MedicationPeriods`: from `StartsAt` until the medication's next period, its
`Times`, or none while `Paused`. The app starts one when a medication is created, its times change, or it is paused or
resumed, never for a name, dose or sharing edit, and never changes it afterwards. `MedicationPeriod.DosesBetween` reads
them, so the summary, the notices, the app's history and the PDF expect the same doses on a past day; `Medication.Times`
and `Paused` are only the current state. A period, like a dose, needs its medication on the server or in the same
batch.

A medication reaches the contact only with `SharedWithContact`; removing the contact clears it on every medication.

`POST sync/heartbeat` is the sign of life: the app sends it on opening and periodically in the background, with the
platform, the IANA time zone and the Expo push token, which are kept on the `Account` row (one active device). Login,
an upload and a heartbeat set `Account.LastSeenAt` from the server's clock; that is the "contact" the notice rules read.
A new active device clears the push token until its own heartbeat arrives.

### Notices: worker and outbox

Every family notice goes through the outbox. App events ("Tomei", SOS, heartbeat) and the worker's time-based checks
(missed doses, the 20:00 summary, no contact, abandonment) raise domain events; the interceptor writes them to
`OutboxMessages` in the same transaction; the outbox processor polls every few seconds, so SOS goes out fast, and hands
them to the handlers that call WhatsApp. Delivery is at-least-once, so every notice carries an idempotency key (for
example dose + notice type) to avoid paying twice for the same message.

How it is built:

- `NoticeService.Check(accountId, now)` holds every time-based rule (missed dose, summary, no contact with a ping
  first, abandonment pause, birthday) and takes the instant as a parameter, so tests run it at any time without
  waiting. Its numbers are `NoticeSettings`, whose defaults are the only place they are written; the `Notices`
  configuration section overrides them.
- A decision is a `Notice` row with a unique `Key` (account + kind + what it is about: the dose's date and time, the
  day, the last contact). The key is what stops a notice from being decided twice, and what makes the one-off notices
  repeat only after the state changes (the no-contact key is the last contact, the pause key the last "Tomei").
- `Notice.Create` raises `NoticeCreatedDomainEvent`; `SendNoticeHandler` sends it through `INoticeSender`
  (`Domain/Contracts/Messaging`) and sets `Status`, which stops a retried delivery from paying twice: `Sent`, with
  WhatsApp's `MessageId` and `SentAt`, or `NotSent` when there is no Premium, no linked contact or nothing left to say.
  WhatsApp's delivery statuses then move it forward (`Delivered`, `Read`, `Failed`). The message is
  built when it is sent, from the current data, by `NoticeMessageBuilder`: a `NoticeTemplate` and its values, the
  person always first in the "of" form ("da sua mãe, Maria"). A missed dose recorded in the meantime sends nothing.
- The ping is `Account.RequestPing`, which raises `DevicePingRequestedDomainEvent`; `SendPingHandler` pushes it (see
  "Push"). `PingWait` after the ping, the silence is decided once, keyed by the last contact: `Uninstalled` when Expo
  says the push no longer reaches the app, `NoContact` otherwise.
- `NoticeWorker` (every minute, one scope per account) and `OutboxWorker` (every 5 seconds) are the hosted services.
  Tests remove both and call `NoticeService` and `OutboxProcessor` themselves.
- A message whose handler throws is tried again after 10 seconds, then twice as long each time, and given up after
  `OutboxProcessor.MaxAttempts` (10, about an hour and a half); one still unprocessed with that many `Attempts` was
  given up on, and its last `Error` says why. A failing message waits out its `NextAttemptAt` instead of holding back
  the ones behind it.
- Only Premium accounts whose contact linked up on WhatsApp and didn't answer PARAR are checked (`AccountsToCheck`),
  and only medications with `SharedWithContact` (not paused, not deleted) count. The handler checks Premium and the
  contact again before sending; a notice decided before Premium ended is never sent. Abandonment counts from
  `Account.LastTakenAt`, the latest "Tomei" received, or the account's creation.
- A missed dose is notified only while its deadline is under an hour old, so a worker outage or a contact added
  later doesn't send stale notices, and only for doses scheduled after the medication's last change.

### WhatsApp

`Anticorruption.WhatsApp` calls Meta's Cloud API directly (`WhatsAppClient`): template messages for notices, and free
text only for replies inside the 24 hours a message from that number opened. Settings are the `WhatsApp` section
(`PhoneNumberId`, `AccessToken`, `AppSecret`, `VerifyToken`, `ApiVersion`); the secrets go in user secrets or the
environment. Without an `AccessToken` nothing is sent, only logged, which is how local runs work. Logs never carry
phone numbers or message text.

- The template names and the order of their values are in `docs/arquitetura.md` ("Modelos de mensagem");
  `WhatsAppNoticeSender.TemplateName` maps `NoticeTemplate` to them. A template's text changes in WhatsApp Manager,
  its values here.
- Linking: every contact gets an 8-character `LinkCode`; the app reads it from `GET contact/link` and puts it, as a word
  of its own, in the prefilled message to the app's number. The webhook (`api/v1/webhooks/whatsapp`, signed with
  `X-Hub-Signature-256`) hands text messages to `ContactLinkService.Receive`: a known code links the sender's number
  (`Contact.WhatsAppNumber`, where notices go, not `Phone`), PARAR stops every contact with that number, and sending
  the code again resumes. Each message gets a reply. Linking works without Premium (the app shows the link only
  with it): the link is kept, and the reply says the notices start once Premium is active.
- A new phone for the contact drops the link and draws a new code: another person links up themselves.
- The webhook's delivery statuses update the notice with that `MessageId`, only forward, since Meta may send them out
  of order. Failures are also logged with Meta's error codes.
- Meta answering 400 to a send means it won't take that message as it is (an unapproved template, a wrong value, a
  number it rejects): `WhatsAppNoticeSender` throws `NoticeRefusedException`, and the notice is `Failed` at once,
  with no retry. Any other error (a rate limit, an expired token, an outage) goes back to the outbox's retries.
- Tests replace Meta with `FakeWhatsApp`, an `HttpMessageHandler` that records what the API sends;
  `CmiApiFactory.ReceiveWhatsAppStatus` plays a delivery status.

### SOS

The help request over WhatsApp is Premium; the free SOS (a call, or an SMS opened with the text ready, from the
phone's own plan) never reaches the server.

- `POST sos` takes the device's request `Id` and `RequestedAt`, with the phone's offset, and returns its status. It is
  a `Notice` of kind `Sos` keyed by that id, so the outgoing queue can send it again safely, and the outbox sends it
  within seconds through `SendNoticeHandler`, like any notice: `pedido_de_ajuda`, with the person and the day and
  time on their clock.
- `GET sos/{id}` is the status the app shows: null while it waits for the outbox, then `NotSent` (the app offers the
  call and the SMS), `Sent`, `Delivered`, `Read` or `Failed`. Null for more than a few seconds means the send is
  failing and being retried, or there is no connection: the app offers the call then too.
- A device that is no longer the active one may still ask for help.

### Premium

`Account.PremiumUntil` is the only Premium state on the server, and only `Anticorruption.RevenueCat` writes it.
`Account.IsPremium(now)` is the check. The app user id in RevenueCat is the account id.

- The webhook (`api/v1/webhooks/revenuecat`) checks the `Authorization` header against
  `RevenueCat:WebhookAuthorization`, the value set in RevenueCat's dashboard. It doesn't interpret the event type: it
  takes every account id the event names (app user, aliases, transfer from and to) and reads that customer back from
  RevenueCat's REST API v1 (`GET subscribers/{id}`, with the `RevenueCat:ApiKey` secret key), as RevenueCat
  recommends. Refunds, transfers, repeated and out-of-order events need no rules of their own that way.
- `PremiumUntil` is the `RevenueCat:EntitlementId` entitlement's expiry, or its grace period's when later; an
  entitlement that never expires is `DateTime.MaxValue`; no entitlement is null. Sandbox purchases count, so
  TestFlight and the stores' review can test Premium.
- A failing call returns an error, and RevenueCat retries for about 80 minutes.
- Tests replace RevenueCat with `FakeRevenueCat`, and `CmiApiFactory.SetPremium` plays a store change.

### Push

`Anticorruption.ExpoPush` implements `IPushSender` (`Domain/Contracts/Push`) over Expo's push service, which hands
the push to Google and Apple. The optional `ExpoPush:AccessToken` is needed only once "enhanced push security" is on
in Expo's dashboard.

- The ping goes with high priority (to wake a sleeping Android phone) and `contentAvailable` (to wake the app on
  iOS). Its ticket is kept in `Account.PingTicketId`.
- Expo's `DeviceNotRegistered`, in the ticket or later in the receipt, sets `Account.PushUnregisteredAt` and drops the
  push token, which Expo says to stop using. It means the push no longer reaches the app: uninstalled, or
  notifications turned off, which stops the reminders too. It can come late, so it is only read once, when the
  silence is decided; until then, or without it, the family hears `NoContact`. The next contact clears it.
- Tests replace Expo with `FakeExpoPush`, and `CmiApiFactory.NewPushToken` gives each test its own token.

### API contract

- Enums travel by name in JSON, both ways, through a global `JsonStringEnumConverter` in `Program.cs`; don't add
  per-enum attributes.
- Actions return `ActionResult<T>` (or `NoContentResult`), never a bare `IActionResult`, so the OpenAPI document
  describes every response.

### Conventions that the build enforces

`Directory.Build.props`, `Directory.Packages.props`, `global.json`, `.editorconfig` and `NuGet.Config` came from
RevoSolutions.TVP; keep them in step with it unless CMI needs otherwise.

- Central Package Management: add versions in `Directory.Packages.props`; reference by name only in `.csproj`.
- Never set `TargetFramework` or `Version` in a `.csproj` — they come from `Directory.Build.props`.
- Style and naming are enforced by `.editorconfig` (`var` preferred, `_camelCase` private fields,
  file-scoped namespaces). Run `dotnet format` before committing.
- Migrations come from `dotnet ef migrations add <Name> ... --output-dir Migrations`; that folder is generated code.
- Persistence is the only project that knows about EF Core. Keep `Domain` free of infrastructure types. The one
  exception is `API/Authentication/AccountService` (see Authentication).

## Build & test

Backend:

```bash
dotnet build
dotnet test                                         # needs Docker: Testcontainers starts a postgres:17
dotnet format --verify-no-changes --severity warn   # CI gate
```

Running the API locally (Scalar at http://localhost:5090/scalar):

```bash
docker compose up -d                                # Postgres 17 on port 5433, next to TVP's on 5432
dotnet ef database update --project src/RevoSolutions.CMI.Data.PostgreSql --startup-project src/RevoSolutions.CMI.API
dotnet run --project src/RevoSolutions.CMI.API
```

After a model change: `dotnet ef migrations add <Name> --project src/RevoSolutions.CMI.Data.PostgreSql
--startup-project src/RevoSolutions.CMI.API --output-dir Migrations`. `dotnet tool restore` installs `dotnet-ef`.
Real logins need `SocialLogin:GoogleClientIds` / `SocialLogin:AppleClientIds` in user secrets; the tests don't.

The API's image (`src/RevoSolutions.CMI.API/Dockerfile`, built from the repository root, listening on 8080) is what
gets deployed. The `image` workflow, run by hand, publishes it to `ghcr.io/<repo>/api` with the commit's sha and
`latest`. Add `GSS Encryption Mode=Disable` to the connection string the container gets: the image has no Kerberos,
and Npgsql logs an error at every connection otherwise.

```bash
docker build -f src/RevoSolutions.CMI.API/Dockerfile -t cmi-api:local .
```

Mobile, from `mobile/`:

```bash
npm ci
npx expo start --dev-client
npx expo lint                                       # CI gate, with tsc and the tests
npx tsc --noEmit
npm test                                            # Jest (jest-expo), for the pure logic
```

## Not done yet

What the MVP includes and what comes after it: `docs/escopo.md`.

- The back end has login, refresh, logout, the active device, account deletion, the profile with the name, sync, the
  heartbeat, the notice rules, the worker, the outbox, WhatsApp (linking, PARAR, the notice templates), Premium
  from RevenueCat, which gates the notices, the push ping with the uninstalled-app notice, and SOS with its delivery
  status. Not yet: the web page to ask for account deletion (Google requires it), the terms and the privacy policy,
  and the hosting.
- RevenueCat itself isn't set up yet: the products, the 14-day trial, the `premium` entitlement and the webhook with
  its Authorization header.
- The eight templates still have to be submitted and approved in WhatsApp Manager before anything reaches a family member.
- Processed outbox messages and expired refresh tokens are never deleted; add a cleanup when the tables grow.
- SOS over WhatsApp has no cap per account; each one is paid. Add one if a bug or abuse ever sends too many.
- CI (`.github/workflows/ci.yml`) checks the back end (format, build, tests) and the app (generated content, lint,
  types, tests). The API image is published, but where it runs isn't chosen yet: Azure Container Apps with a minimum
  of one replica, as in TVP (`docs/deploy-azure.md` there), or a VPS with Docker Compose (`docs/arquitetura.md`,
  "Hospedagem"). The rollout step, applying the migrations and the daily backup come with that choice.
- The Expo app has social login, the account sessions, sync through the outgoing queue, the heartbeat and the ping,
  the first-run setup with the profile and the health questionnaire, and the medication flow: tabs **Hoje** and
  **Remédios**, the form, the history, the reminder screen and the reminders (`src/lib/reminders.ts`). **Telefones**
  (the trusted contact on top, then the numbers by category) and **Artigos** read `src/content.ts`. **Relatório para
  a consulta** (`features/report`), opened from **Remédios**, builds the list and the regularity PDF on the device;
  `expo-print` and `expo-sharing` are native, so it needs a new build. OAuth, FCM
  and APNs still have to be set up and the flow validated on real phones (`mobile/README.md`). A `POST sync` refused
  with 400 holds up the queue: it is retried, never dropped, and only the card on **Hoje** shows it. Setup gets the
  contact step with phase 5. A phone that ran the old reminder
  test needs the app reinstalled to drop its leftover test notifications. Validate the reminders on Android and a real iPhone
  before calling the flow done. `react-native-screens` is native, so running the navigation needs a development or
  preview build made after it was added.

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, imperative and lowercase
(`feat(mobile): schedule dose reminders`).

- Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Add `!` after the type or
  scope when an API change breaks clients (`feat(api)!: ...`).
- Scope is optional and names the area touched: `mobile`, `domain`, `data`, `api`, `auth`, `deps`.

## Agents

This file is the single source of instructions for every coding agent. `CLAUDE.md` imports it, Gemini CLI reads it
through `.gemini/settings.json`, and Codex reads it directly. Put new instructions here, never in those files.
