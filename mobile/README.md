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
npx eas-cli@latest update --channel preview --environment preview --message "o que mudou"
```

Cada update vai só para os builds com o mesmo runtime, calculado pelo fingerprint da parte nativa. Depois de adicionar uma dependência nativa ou mudar `app.json`, gere um build novo: os builds antigos continuam com os updates do runtime deles.

## Login e push

Copie `.env.example` para `.env.local` no desenvolvimento. Nos builds do EAS, configure as mesmas variáveis nos ambientes `development` e `preview`.

- `EXPO_PUBLIC_API_URL` aponta para a API. O emulador Android alcança o PC em `http://10.0.2.2:5090`. Num aparelho, use uma URL acessível pela rede do aparelho. Use HTTPS para a API hospedada.
- `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` é o ID público do cliente OAuth web, que também precisa estar em `SocialLogin:GoogleClientIds` na API. No Google Cloud, cadastre um cliente Android para `com.revosolutions.cmi` com o SHA-1 do certificado de cada build usado no teste. O iPhone usa também `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, do cliente OAuth iOS para o mesmo identificador.
- `EXPO_PUBLIC_WHATSAPP_NUMBER` é o número do app no WhatsApp, com o código do país (`5511...`). O convite e o QR code do vínculo abrem uma conversa com ele.
- Para Apple, ative **Sign in with Apple** para `com.revosolutions.cmi` na conta Apple Developer e aceite esse identificador em `SocialLogin:AppleClientIds` na API.
- Para push no Android, indique o caminho de `google-services.json` em `GOOGLE_SERVICES_JSON`. No EAS use uma variável do tipo arquivo e configure a credencial FCM v1. Para iOS configure a credencial APNs. O app só obtém o token Expo com notificações permitidas.

Gere um novo development build depois de configurar os clientes OAuth ou o Firebase. Confira o login, o retorno offline à conta, a exclusão e o ping com builds nativos em aparelhos reais. O sistema decide quando roda o heartbeat em segundo plano.

Referências de configuração. [Google Sign-In no Expo](https://react-native-google-signin.github.io/docs/setting-up/expo) · [AppleAuthentication](https://docs.expo.dev/versions/latest/sdk/apple-authentication/) · [Credenciais de push no Expo](https://docs.expo.dev/push-notifications/push-notifications-setup/)

## Cliente da API

Com a API de desenvolvimento em execução, use `npm run api` para salvar o OpenAPI e regerar o cliente. Use `OPENAPI_URL` se a API estiver em outra porta. `npm run api:generate` gera o cliente a partir do documento já salvo, sem acessar a API.
