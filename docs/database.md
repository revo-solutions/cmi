# Banco de dados

Diagrama entidade-relacionamento do PostgreSQL, baseado no `CmiDbContextModelSnapshot` após a migration
`AddOutboxRetries`. Atualize o diagrama quando uma migration alterar tabelas, colunas ou chaves.

```mermaid
erDiagram
    Accounts ||..o{ Medications : ""
    Accounts ||..o{ DoseRecords : ""
    Accounts ||..o{ Contacts : ""
    Accounts ||..o{ Notices : ""
    Accounts ||..o{ RefreshTokens : ""
    Medications ||..o{ DoseRecords : ""

    Accounts {
        uuid Id PK
        varchar(20) Provider "provedor do login social"
        varchar(255) Subject "identificador no provedor"
        varchar(320) Email "opcional"
        varchar(100) Name "opcional"
        date BirthDate "opcional"
        text[] Conditions "códigos das condições de saúde"
        varchar(200) OtherCondition "opcional"
        boolean LivesAlone "opcional"
        boolean FellLastYear "opcional"
        boolean VisionDifficulty "opcional"
        timestamptz ProfileUpdatedAt "opcional"
        uuid ActiveDeviceId
        varchar(20) Platform "opcional"
        varchar(100) TimeZone "fuso IANA, opcional"
        varchar(200) PushToken "opcional"
        timestamptz LastSeenAt "opcional"
        timestamptz LastTakenAt "opcional"
        timestamptz PingSentAt "opcional"
        varchar(100) PingTicketId "ticket do ping no Expo, opcional"
        timestamptz PushUnregisteredAt "push não chega mais ao app, opcional"
        timestamptz PremiumUntil "fim do Premium, pelo RevenueCat, opcional"
        timestamptz CreatedDate
    }

    Medications {
        uuid Id PK
        uuid AccountId FK
        varchar(200) Name
        varchar(200) Dose "opcional"
        time[] Times "horários locais"
        boolean Paused
        boolean Deleted "exclusão lógica"
        boolean SharedWithContact
        timestamptz UpdatedAt
        timestamptz CreatedDate
    }

    DoseRecords {
        uuid Id PK
        uuid AccountId FK
        uuid MedicationId FK
        date ScheduledDate
        time ScheduledTime
        timestamptz TakenAt "nulo sem confirmação registrada"
        timestamptz UpdatedAt
        timestamptz CreatedDate
    }

    Contacts {
        uuid Id PK
        uuid AccountId FK
        varchar(200) Name
        varchar(30) Phone "ligações e SMS"
        varchar(20) Relationship "na perspectiva do contato"
        varchar(8) LinkCode UK
        varchar(20) WhatsAppNumber "opcional"
        timestamptz LinkedAt "opcional"
        timestamptz StoppedAt "opcional"
        timestamptz UpdatedAt
        timestamptz CreatedDate
    }

    Notices {
        uuid Id PK
        uuid AccountId FK
        varchar(20) Kind
        varchar(150) Key UK "chave de idempotência"
        date Day
        time ScheduledTime "opcional"
        timestamptz SentAt "opcional"
        varchar(100) MessageId "id da mensagem no WhatsApp, opcional"
        varchar(20) Status "NotSent, Sent, Delivered, Read ou Failed, opcional"
        timestamptz CreatedDate
    }

    RefreshTokens {
        uuid Id PK
        uuid AccountId FK
        uuid DeviceId
        varchar(64) TokenHash UK "SHA-256"
        timestamptz CreatedAt
        timestamptz ExpiresAt
        timestamptz RotatedAt "opcional"
        timestamptz RevokedAt "opcional"
    }

    OutboxMessages {
        uuid Id PK
        varchar(500) Type
        text Content "evento serializado em JSON"
        timestamptz OccurredOn
        timestamptz ProcessedOn "opcional"
        text Error "última falha, opcional"
        integer Attempts "tentativas com falha"
        timestamptz NextAttemptAt "próxima tentativa, opcional"
    }
```

## Notas

- O par `(Provider, Subject)` é único em `Accounts`. O perfil e os dados do aparelho ativo ficam na própria
  conta.
- As chaves estrangeiras usam `ON DELETE CASCADE`. Na sincronização, a exclusão lógica de medicamentos
  (`Deleted = true`) preserva o histórico de doses.
- O índice de `Contacts.AccountId` permite vários registros por conta. O vínculo usa `LinkCode` e os avisos
  seguem para `WhatsAppNumber` após a confirmação pelo contato.
- O índice de `Notices.MessageId` permite localizar o aviso quando o webhook do WhatsApp informa o status da
  entrega.
- `OutboxMessages` guarda os eventos de domínio na mesma transação da alteração que os gerou e fica sem chave
  estrangeira. O processador usa `Attempts` e `NextAttemptAt` para limitar e agendar as novas tentativas.
