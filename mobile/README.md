# Teste de lembretes da Central Melhor Idade

A tela agenda uma notificação local para daqui a um minuto. **Tomei** grava no SQLite o horário e o modo de execução. **Lembrar depois** agenda outra notificação um minuto depois para o mesmo teste.

A tela usa o logo de `docs/marca/`, a paleta da marca e a fonte Atkinson Hyperlegible Next.

O [plano de implementação do app](../docs/plano-app.md) começa pela validação deste roteiro em aparelhos reais.

## Build

Execute em `mobile/`. O perfil `development` usa o cliente de desenvolvimento e o Metro. Use o perfil `preview` para testar com o JavaScript incluído no aplicativo, inclusive no modo avião e com o app fechado.

```sh
npm ci
npx eas-cli@latest build --profile preview --platform android
npx eas-cli@latest build --profile preview --platform ios --auto-submit
```

O app está vinculado ao [projeto da organização revosolutions no Expo](https://expo.dev/accounts/revosolutions/projects/central-melhor-idade). Entre com uma conta Expo que tenha acesso a esse projeto. O perfil gera um APK de distribuição interna no Android e, no iOS, um build de loja que `--auto-submit` envia ao TestFlight; configure antes as credenciais de uma conta Apple Developer. O EAS guarda e incrementa o número de cada build.

## Atualização pelo ar

Mudanças de JavaScript e de conteúdo chegam aos builds instalados pelo EAS Update, sem nova versão na loja. O app baixa a atualização ao abrir e a aplica na abertura seguinte.

```sh
npx eas-cli@latest update --channel preview --message "o que mudou"
```

Cada update vai só para os builds com o mesmo runtime, calculado pelo fingerprint da parte nativa. Depois de adicionar uma dependência nativa ou mudar `app.json`, gere um build novo: os builds antigos continuam com os updates do runtime deles.

## Roteiro no aparelho

1. Abra o app e toque em **Agendar lembrete**. Aceite notificações e, no Android, libere **Alarmes e lembretes** quando o sistema abrir os ajustes.
2. Ative o modo avião. Volte à tela inicial ou retire o app da lista de recentes, bloqueie o celular e aguarde a notificação. Teste esses dois estados em execuções separadas.
3. Expanda a notificação, toque em **Tomei**, aguarde alguns segundos e reabra o app manualmente. Confira a origem e compare o horário do registro com o da reabertura no cartão **Último teste**. O registro deve ter sido salvo antes da reabertura.
4. Repita com **Lembrar depois**. Aguarde a segunda notificação e confirme com **Tomei**. Confira se houve uma única nova notificação e se o registro continuou disponível após fechar o app novamente.
5. Repita com TalkBack ou VoiceOver e fonte ampliada. No Android, registre o fabricante, modelo e versão do sistema junto com o resultado. No iPhone, repita com a tela bloqueada e o app em segundo plano e retirado da lista de recentes.

No teste de app fechado no Android, retire-o da lista de recentes. O comando **Forçar parada** dos ajustes é um estado diferente do sistema.
