# Central Melhor Idade

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
