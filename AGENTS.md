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
  medication that wasn't shared. Revoking access deletes the contact's and the shared medications' data from the
  server.
- The app stands on its own: the person can use it and buy Premium with no family member linked. What is free and
  what is Premium is in `docs/escopo.md`. Rule: anything with a per-use cost is Premium. Every WhatsApp send (linking,
  routine notices, SOS over WhatsApp, birthday reminder) is Premium; free SOS calls or opens an SMS from the phone's
  own plan. The server and sync are fixed costs and stay free.
- Social login is mandatory at setup, with no passwords: Google on Android; Apple and Google on iOS (Apple requires
  its own login whenever Google's is offered). The account follows the person to any phone: medications, history,
  contact, profile and Premium. Account deletion is available in the app and deletes everything on the server.
- Setup order: login, name (prefilled from the login; the notices use it) and birth date (large day/month/year fields,
  not the system calendar), health questionnaire (one
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
  real iPhone. `src/features/<feature>` holds a feature's screens and logic, `src/components` the shared UI, `src/lib`
  the API client and device helpers.
- Reuse the installed development client with Metro for TypeScript and UI changes. Rebuild it to test changes to
  native dependencies or configuration. Batch changes for standalone preview builds when testing without Metro,
  such as offline reminders with the app closed. EAS keeps and increments the build numbers (`appVersionSource`
  remote); don't set `versionCode` or `buildNumber` in `app.json`.
- Reminders use `expo-notifications` (daily repeating triggers, "Tomei" and "Lembrar depois" actions) and
  `expo-background-task` (the outgoing queue and the heartbeat), behind one TypeScript interface. Prefer Expo modules
  over bare native code; own Kotlin or Swift code goes behind that same interface, and only when tests on real devices
  prove the gain. Leaving the managed workflow needs a reason written here.
- The server's ping (see "Push") is a data-only push, `{ "type": "ping" }` with no title or body, so nothing shows.
  The app answers it with a heartbeat from a background notification task (`expo-task-manager`; on iOS the
  `expo-notifications` plugin's `enableBackgroundRemoteNotifications`).
- SQLite (`expo-sqlite`) on the device keeps the app working offline. Every change is synced to the server through
  the outgoing queue (see `docs/arquitetura.md`, "Sincronização"): records get a UUID and an updated-at on the
  device, the last write wins, and only one device per account is active.
- Login uses `@react-native-google-signin/google-signin` and `expo-apple-authentication`; the app exchanges the
  provider's token for the API's JWT and refresh token, kept in the system's secure storage.
- Purchases use the RevenueCat SDK (`react-native-purchases`) with the account id as the app user id. The app reads
  the entitlement from the SDK only to show what is unlocked.
- The doctor report uses `expo-print` and `expo-sharing`.
- The API client is generated from the OpenAPI document with orval, as in RevoSolutions.TVP's `web/`.
- Content lives in `mobile/content/`: one Markdown file per article (frontmatter with title, theme, health-condition
  codes and date), `telefones.json` (category, name, number, whether it is an emergency number) and the Premium promo
  texts. No admin UI and no content endpoint; new content ships with EAS Update.
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
  (`Domain/Contracts/Messaging`) and sets `SentAt`, which stops a retried delivery from paying twice. The message is
  built when it is sent, from the current data, by `NoticeMessageBuilder`: a `NoticeTemplate` and its values, the
  person always first in the "of" form ("da sua mãe, Maria"). A missed dose recorded in the meantime sends nothing.
- The ping is `Account.RequestPing`, which raises `DevicePingRequestedDomainEvent`; `SendPingHandler` pushes it (see
  "Push"). `PingWait` after the ping, the silence is decided once, keyed by the last contact: `Uninstalled` when Expo
  says the push no longer reaches the app, `NoContact` otherwise.
- `NoticeWorker` (every minute, one scope per account) and `OutboxWorker` (every 5 seconds) are the hosted services.
  Tests remove both and call `NoticeService` and `OutboxProcessor` themselves.
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
- Tests replace Meta with `FakeWhatsApp`, an `HttpMessageHandler` that records what the API sends.

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

Mobile, from `mobile/`:

```bash
npm ci
npx expo start --dev-client
npx expo lint                                       # CI gate, with tsc
npx tsc --noEmit
```

## Not done yet

What the MVP includes and what comes after it: `docs/escopo.md`.

- The back end has login, refresh, logout, the active device, account deletion, the profile with the name, sync, the
  heartbeat, the notice rules, the worker, the outbox, WhatsApp (linking, PARAR, the notice templates), Premium
  from RevenueCat, which gates the notices, and the push ping with the uninstalled-app notice. Not yet: SOS.
- RevenueCat itself isn't set up yet: the products, the 14-day trial, the `premium` entitlement and the webhook with
  its Authorization header.
- WhatsApp delivery statuses are only logged when they fail; storing them comes with SOS, whose status the app shows.
- The seven templates still have to be submitted and approved in WhatsApp Manager before anything reaches a family member.
- A failing outbox message is retried every 5 seconds forever, as in TVP; add a limit if one ever gets stuck.
- CI (`.github/workflows/ci.yml`) checks the back end (format, build, tests) and the app (lint, types). No Dockerfile
  or deploy workflow yet; take them from TVP when deploying.
- The Expo app has only a local reminder test. Validate it on Android and a real iPhone with a bundled preview build
  before building the medication screens. See `mobile/README.md`.

## Commits

[Conventional Commits](https://www.conventionalcommits.org): `type(scope): summary`, imperative and lowercase
(`feat(mobile): schedule dose reminders`).

- Types: `feat`, `fix`, `refactor`, `perf`, `test`, `docs`, `build`, `ci`, `chore`. Add `!` after the type or
  scope when an API change breaks clients (`feat(api)!: ...`).
- Scope is optional and names the area touched: `mobile`, `domain`, `data`, `api`, `auth`, `deps`.

## Agents

This file is the single source of instructions for every coding agent. `CLAUDE.md` imports it, Gemini CLI reads it
through `.gemini/settings.json`, and Codex reads it directly. Put new instructions here, never in those files.
