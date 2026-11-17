# Plano de implementação do app

Roteiro para levar o app em `mobile/` do teste de lembrete ao MVP descrito em [escopo.md](escopo.md), seguindo
[arquitetura.md](arquitetura.md), a [marca](marca/README.md), o `AGENTS.md` e as telas do
[canvas de identidade](https://claude.ai/artifact/KkgXf3Cyrsv7azcrM7StK1) (Entrada, Hoje, Lembrete e SOS). Marque os
itens à medida que forem feitos e apague o plano quando o MVP estiver nas lojas, tirando o link dele do escopo.

O app hoje abre na tela de teste: agenda uma notificação única e grava **Tomei** e **Lembrar depois** em SQLite.
A API já oferece login, sincronização, heartbeat, vínculo, SOS e os webhooks de WhatsApp e RevenueCat. As regras
de produto continuam no [escopo do MVP](escopo.md#mvp); o brainstorming e as evoluções pós-MVP ficam de fora.

A ordem segue a regra do escopo: o maior risco está nos lembretes, então o motor de agenda vem antes das telas e é
testado em aparelhos reais a cada fase. Cada fase termina num build `preview` instalado no Android e, quando mexer em
lembretes, num TestFlight.

As decisões 6 e 7 vêm antes do esquema e das telas de doses, para que o histórico, o PDF e os avisos não reconstruam
o passado com os dados de hoje. O cadastro e as doses podem ser implementados primeiro com SQLite (fases 1–2); conta
e sync tornam esses dados recuperáveis (fase 3). A configuração inicial integra as telas de remédios e contato (fases
2 e 5). O aceite do WhatsApp depende também do Premium (fase 6); o PDF depende do histórico da fase 2 e do Premium.
Telefones, artigos e conteúdo inicial podem avançar após a navegação. Preparar credenciais, lojas e modelos em
paralelo com os lembretes.

## Decisões antes de começar

Cada uma tem uma recomendação. Ao decidir, registre no `AGENTS.md` (seção Mobile) e tire daqui.

1. **Navegação.** React Navigation (`native-stack` e `bottom-tabs`) com a configuração estática num arquivo só, para
   manter as telas em `src/features/<feature>`. O `expo-router` traria a pasta `app/` com uma rota por arquivo, uma
   segunda convenção de pastas sem ganho para um app de poucas telas.
2. **Estado.** Sem biblioteca de estado. O SQLite é a fonte da verdade, e as telas leem por hooks pequenos que
   reconsultam quando o banco avisa uma mudança, como o `onReminderTestChange` de hoje.
3. **Artigos em Markdown.** Um script (`npm run content`) converte `content/` num módulo TypeScript versionado, e o CI
   confere se ele está atualizado. A tela desenha um subconjunto pequeno (títulos, parágrafos, listas, negrito) com os
   componentes do app, para respeitar a fonte do sistema e o TalkBack. Uma biblioteca de Markdown só entra se o
   conteúdo pedir mais que isso.
4. **Campos de horário.** Os horários do remédio usam campos grandes de hora e minuto com botões de mais e menos, como
   a data de nascimento, em vez do relógio do sistema.
5. **Alto contraste.** A marca define só o modo de letras grandes (1,25×). A paleta já passa de 4,5:1 nos textos, então
   o "alto contraste" do questionário pode ser só bordas mais fortes e nenhum texto em Grafite. Decidir com a marca
   antes da fase 4.
6. **Histórico de pausas e de horários.** Antes da fase 1, porque define o esquema do SQLite, o que editar, pausar e
   retomar gravam na fase 2 e o que o histórico mostra. Hoje o servidor guarda só os horários e a pausa vigentes, e
   `Medication.DosesBetween` reconstrói o passado com eles, descartando as doses anteriores ao `UpdatedAt`. Como o
   `UpdatedAt` muda em qualquer edição (até no texto da dose ou no compartilhamento), o resumo das 20h e os avisos de
   dose sem confirmação já perdem doses do dia: ligar o compartilhamento às 19h tira do resumo as doses da manhã,
   inclusive as registradas. Recomendação: o aparelho grava cada mudança de horários e cada pausa como um período,
   esses períodos sobem na sincronização (uma lista nova no `SyncModel`), e o `DosesBetween` passa a usá-los no lugar
   do corte pelo `UpdatedAt`. Assim histórico, PDF, resumo e avisos têm uma só definição de dose esperada, e quem
   troca de celular não vê pausas antigas como esquecimento, o que o escopo proíbe.
7. **Estado da dose.** Depois da decisão 6, que diz quais doses eram esperadas, e antes da fase 2. `GET sync` retorna
   horário e `TakenAt`, sem estado calculado, e o "sem confirmação" do servidor existe só como `Notice`, decidido também
   pelo contato nas 6 horas anteriores, que o aparelho não conhece. O aparelho calcula o estado a partir dos dados
   locais: uma dose esperada é **Pendente** até 1 hora depois do horário, **Registrado** com `taken_at` (mesmo com o
   envio pendente) e **Sem confirmação** depois do prazo sem **Tomei**. O prazo é uma constante no app igual a
   `NoticeSettings.MissedDoseAfter`; o escopo diz que é o mesmo número nos dois lados. A regra das 6 horas fica só no
   servidor: ela decide se o familiar é avisado, não o que a pessoa vê. O estado da tela não significa que um aviso foi
   enviado.
8. **Reativação do aparelho.** Antes da fase 3. O `SyncService` cria todo contato desconhecido que não chega como
   excluído, e o servidor esquece o contato removido; uma edição antiga na fila de um celular inativo recriaria o
   contato revogado pelo celular novo. Ao tocar em **Usar neste celular**, o app envia da fila só os registros de dose
   (os medicamentos excluídos ficam no servidor como exclusão lógica, então o lote passa), descarta as alterações
   pendentes de medicamentos, contato e perfil e baixa a cópia completa do servidor. A tela avisa antes que as
   alterações feitas naquele celular serão substituídas. Nenhuma mudança no back-end.
9. **Ajustes de experiência.** **Lembrar depois** adia 10 minutos; o cartão do questionário volta 3 dias depois de
   pulado (os dois no escopo, cada um num ajuste só). Letras grandes e alto contraste ficam só no aparelho: o
   `ProfileModel` não tem esses campos, e a fonte do sistema já é de cada celular. No relatório, o atraso típico é a
   mediana de `taken_at` menos o horário marcado das doses registradas, e o percentual conta sobre as doses esperadas,
   sem os dias pausados e sem as doses ainda dentro do prazo. No aparelho não há "sem dados": o histórico local está
   sempre ali.

## Fase 0: validar o motor de lembretes

Em andamento. Nada de telas de medicamento antes de terminar.

- [ ] Rodar o roteiro do [README do app](../mobile/README.md) num Android (de preferência Xiaomi, Samsung ou Motorola)
      com build `preview`, app fechado e modo avião.
- [ ] Rodar o mesmo roteiro num iPhone real pelo TestFlight, com a tela bloqueada e o app fora da lista de recentes.
- [ ] Sentry (`@sentry/react-native`) neste mesmo build, para ver os erros dos iPhones de terceiros.
- [ ] Registrar os resultados (aparelho, sistema, origem do registro) e decidir se o `expo-notifications` basta. Se
      não bastar, o código nativo entra atrás da interface de lembretes, com o motivo escrito no `AGENTS.md`.
- [ ] Provar o gatilho diário repetido no mesmo roteiro antes do cadastro. Testar permissões negadas ou revogadas,
      economia de bateria, modo Foco, reinício e mudança de fuso. O iOS guarda no máximo 64 notificações pendentes, e
      cada horário diário repetido conta uma: horários, adiamentos, aniversário e aviso do fim do teste somados ficam
      abaixo disso, e o cadastro avisa bem antes do limite.

**Aceite:** **Tomei** fica salvo offline antes de reabrir o app; **Lembrar depois** dispara uma vez, mantém o horário
original da dose e preserva o próximo disparo diário. A mesma ação entregue duas vezes não duplica o registro.

## Fase 1: fundação

- [ ] Navegação: abas **Hoje**, **Remédios**, **Telefones** e **Artigos**, como no canvas, e **Perfil** pelo botão
      do cabeçalho. Rótulos das abas com `maxFontSizeMultiplier` 1,15.
- [ ] Componentes em `src/components`, já acessíveis (papel, rótulo, área mínima de 56 dp e 64 dp nas ações
      principais):
  - `AppText`, com os papéis de `theme.ts` e o multiplicador do modo de letras grandes;
  - `Screen`, com área segura e rolagem só vertical;
  - `Button` nas variantes principal, Tomei, SOS e secundária;
  - `Card`, `StatusChip` (ícone e palavra para Pendente, Registrado e Sem confirmação), `Chip`, `TextField`, `YesNo`;
  - campos grandes de dia/mês/ano e de hora/minuto;
  - `Row`, que empilha acima de `stackedFontScale`.
- [ ] SQLite com migrações por `PRAGMA user_version`: `medications`, `dose_records`, `contact`, `profile`,
      `medication_periods` (decisão 6), `outbox` e `settings`. Ids UUID e `updated_at` gerados no
      aparelho, como no `SyncModel`.
- [ ] Jest com `jest-expo` para a lógica pura, rodando no CI junto com o lint e o `tsc`.

**Aceite:** navegação utilizável com TalkBack e VoiceOver, fonte máxima e modo de letras grandes. Formulários e
estados continuam legíveis, com foco previsível, controles rotulados e rolagem só vertical. Conferir isso a cada fase.

## Fase 2: medicamentos e lembretes

- [ ] Interface única em `src/lib/reminders.ts`: agendar e cancelar os lembretes de um medicamento, reconciliar tudo
      ao abrir o app e depois de cada mudança, e receber **Tomei** e **Lembrar depois**. Um gatilho diário repetido
      por horário, com o id `medicamento:horário`; o adiamento é um gatilho único, com o intervalo num ajuste só.
- [ ] **Tomei** cria ou atualiza o registro da dose (medicamento, data e hora marcadas no relógio do aparelho,
      `taken_at`), com a mesma proteção contra a ação entregue duas vezes do teste atual.
- [ ] Tela **Remédios**: lista, cadastro e edição (nome, dose em texto livre, horários), pausar e retomar, excluir
      (fica como exclusão lógica). A chave de compartilhar com o contato só aparece quando há contato. Mudar horários,
      pausar e retomar fecham o período vigente e abrem outro (decisão 6); editar nome ou dose não mexe nos períodos.
- [ ] Tela **Hoje**, como no canvas: o próximo horário com **Tomei**, os horários do dia com o estado de cada um, e o
      botão SOS. Mostrar os estados conforme a decisão 7. Um **Tomei** local já aparece como registrado, mesmo com
      envio pendente.
- [ ] Tela **Lembrete**, aberta pelo toque na notificação: horário em 72, **Tomei** em 30, **Lembrar depois**.
- [ ] Histórico por dia, com a hora do registro e **Desfazer** (limpa `taken_at`). As doses esperadas de cada dia
      vêm dos períodos daquele dia, não dos horários atuais; dias pausados aparecem como pausados.
- [ ] Android: canal `medicamentos`, alarme exato e a orientação para tirar o app da economia de bateria.
- [ ] Testes: estado da dose, próximo horário, reconciliação dos lembretes.
- [ ] Apagar a tela e a tabela do teste de lembrete.

**Aceite:** cadastrar dois remédios com o mesmo horário, registrar um offline, adiar o outro e desfazer um toque.
Editar, pausar e retomar sem alterar o que estava previsto antes da mudança ou deixar alarmes antigos. Cobrir
virada do dia, mudança de fuso e reabertura do app.

## Fase 3: conta, login e sincronização

Precisa da API acessível pelo celular: local, pela rede ou por um túnel, até a hospedagem ser escolhida. A URL vem de
`EXPO_PUBLIC_API_URL` por perfil do EAS.

- [ ] Cliente gerado do OpenAPI pelo orval, como no `web/` do TVP, com o JWT no cabeçalho e a renovação pelo refresh
      token; tokens e o `device_id` (gerado uma vez por instalação) no `expo-secure-store`. Serializar a renovação
      do token rotativo. Permitir abrir o app offline com sessão já configurada.
- [ ] Tela **Entrada**, como no canvas: Google no Android; Apple e Google no iPhone. Plugins e client IDs do
      `@react-native-google-signin/google-signin` e do `expo-apple-authentication` no `app.json`.
- [ ] Primeiro login num aparelho: `GET sync` preenche o SQLite antes de decidir se precisa de configuração inicial;
      recuperar lembretes com as permissões locais e evitar misturar dados ou notificações de contas diferentes.
- [ ] Fila de saída na tabela `outbox`: mudanças em lote por `POST sync`, enviadas após cada mudança, ao abrir, ao
      voltar a conexão e pelo `expo-background-task`, com novas tentativas. Gravar mudança e item de fila na mesma
      transação, enviar medicamentos antes das doses dependentes e preservar edições feitas durante um envio.
- [ ] 409 na sincronização: tela "Sua conta foi aberta em outro celular", com **Usar neste celular**
      (`PUT account/active-device`). Suspender sync até reativar, preservar a fila e reconciliar conforme a decisão 8.
- [ ] Sinal de vida (`POST sync/heartbeat`) ao abrir e em segundo plano, com a plataforma, o fuso IANA e o token do
      Expo. Ligar `enableRemoteNotifications` e as credenciais do FCM e do APNs no EAS.
- [ ] Ping: tarefa de notificação em segundo plano (`expo-task-manager`; no iOS, `enableBackgroundRemoteNotifications`)
      que responde ao `{ "type": "ping" }` com um sinal de vida, sem mostrar nada.
- [ ] Estado da fila visível: um aviso discreto quando há envios pendentes há muito tempo ou com falha.
- [ ] Perfil: **Sair** (`POST auth/logout`) e **Excluir conta** (`DELETE account`), explicando a diferença.
      A exclusão pede confirmação e conexão; limpar dados locais, fila, lembretes e sessão após a API confirmar.

**Aceite:** registrar e corrigir uma dose offline, reconectar e restaurar em outro aparelho. Testar reenvio sem
duplicação, `409`, revogação de contato feita pelo outro aparelho, troca de conta e exclusão.

## Fase 4: configuração inicial

Ordem fixa: login, nome e nascimento, questionário, medicamentos, contato, permissões. Cada passo reaproveita a tela
de edição do Perfil.

- [ ] Nome preenchido com o retorno do login nativo quando disponível, sem substituir o nome já sincronizado.
      A API só retorna tokens, e a Apple só entrega o nome no primeiro login com o app; num segundo aparelho ou numa
      reinstalação, o nome vem do sync ou a pessoa digita. Data de nascimento em campos grandes de dia, mês e ano.
- [ ] Questionário numa tela só, com **Pular** visível: condições pelos códigos de `HealthCondition.Codes` (rótulos
      só no app, "nenhuma" exclusiva, texto livre de "outra") e as três perguntas de sim ou não. Dificuldade para
      enxergar oferece letras grandes e alto contraste. As preferências podem ser alteradas no Perfil.
- [ ] Cartão na **Hoje** que volta a pedir o questionário alguns dias depois de pulado (o número num ajuste só).
- [ ] Medicamentos e contato reaproveitam as telas das fases 2 e 5; o contato pode ser pulado.
- [ ] Permissões: notificações, alarme exato e economia de bateria no Android.
- [ ] Notificação local de parabéns no aniversário, reagendada quando a data muda ou a conta é restaurada. Alinhar
      29 de fevereiro com o servidor e separar essa notificação do aviso Premium ao familiar.

**Aceite:** interromper e retomar a configuração, pular saúde e contato, negar notificações e ainda usar o app.
Revisar respostas pelo Perfil, abrir os ajustes para liberar lembretes e conferir o cartão de saúde na data prevista.

## Fase 5: contato de confiança e SOS

- [ ] Cadastro do contato: nome, telefone e parentesco do ponto de vista do familiar (`Relationship`: pai, mãe, avô,
      avó, tio, tia, amigo, outro). Remover o contato limpa o compartilhamento de todos os medicamentos.
- [ ] Escolha explícita dos medicamentos compartilhados e revogação por remédio ou do contato inteiro. Mostrar quando
      a revogação ainda aguarda sincronização; ao remover, limpar os compartilhamentos locais e no servidor.
- [ ] Ligar (`tel:`) e SMS com o texto pronto (`sms:`), sem a permissão de SMS.
- [ ] Vínculo pelo WhatsApp (Premium): `GET contact/link`, link `wa.me` para o número do app com a mensagem pronta e o
      código, o mesmo link em QR code (`react-native-qrcode-svg`) e o estado pendente, vinculado ou parado (PARAR).
      Explicar os avisos, inclusive aniversário. Atualizar ao voltar à tela; `404` pode ser contato ainda na fila.
      Trocar o telefone exige novo vínculo. O número do app vem de `EXPO_PUBLIC_WHATSAPP_NUMBER`.
- [ ] Tela **SOS**, como no canvas. Grátis: ligar para o contato, SMS e 192. Premium: `POST sos` pela fila (id e
      `requestedAt` com o fuso) e consulta de `GET sos/{id}` até um estado final; enviado, entregue e lido em verde;
      sem internet guardado na fila; não enviado e falha oferecem ligar e **Tentar de novo**. Aguardando por mais de
      alguns segundos também oferece ligar. Informar se um pedido offline ainda pode sair quando a rede voltar.
      O `409` da sincronização não bloqueia a ajuda; não depender do WhatsApp para mostrar as alternativas.
- [ ] Contato de confiança no topo da aba **Telefones**.

**Aceite:** em dois aparelhos, vincular, enviar **PARAR**, retomar pelo código, trocar telefone e revogar. Conferir
em mensagens de teste que a API só inclui remédios compartilhados. Testar SOS pendente, entregue e com falha,
incluindo fila offline sem duplicar envio; o grátis consegue ligar ou abrir SMS sem passar pela API.

## Fase 6: Premium

Depende do RevenueCat configurado (produtos mensal e anual, teste de 14 dias, entitlement `premium`, webhook).

- [ ] `react-native-purchases` com o id da conta como usuário (`logIn` depois do login, `logOut` ao sair).
- [ ] Tela do Premium: R$ 19,90 por mês ou R$ 159,90 por ano, os 14 dias de teste, **Restaurar compras**, e o que o
      Premium libera. Exibir o preço retornado pela loja, a elegibilidade para o teste e o que será cobrado.
      Tratar cancelamento e erro da compra, inclusive para quem não cadastrou contato.
- [ ] O app lê o entitlement só para mostrar o que está liberado: vínculo, SOS pelo WhatsApp e relatório em PDF.
      Tratar estado pendente, offline e expirado. O servidor libera envios só após o webhook. Expirar a assinatura
      pausa os envios e mantém o vínculo para uma futura reativação.
- [ ] Notificação local dois dias antes do fim do teste, com a data e o valor da primeira cobrança, a partir da
      expiração informada pelo SDK. Atualizar ou cancelar ao mudar a assinatura ou sair da conta.
- [ ] Espaços de divulgação no plano grátis, com os textos de `content/`: fim de cada artigo, um cartão a cada 4 ou 5
      artigos, fim das categorias de telefones que não são de emergência. Nunca nas telas listadas como "onde nunca"
      no escopo.

**Aceite:** testar compra sem contato, teste elegível e inelegível, aviso de cobrança, restauração em outro celular,
expiração e nova assinatura em sandbox. Conferir que os envios retomam sem novo vínculo e que não há divulgação no Premium.

## Fase 7: relatório para a consulta

- [ ] Lista de remédios em uso (grátis): nome, dose e horários, na tela e para compartilhar.
- [ ] Resumo do período no grátis ("Você registrou 91% das doses nos últimos 30 dias"), com a oferta do Premium.
- [ ] PDF de regularidade (Premium), de 30, 60 ou 90 dias, montado em HTML a partir do SQLite, gerado pelo
      `expo-print` e compartilhado pelo `expo-sharing`: remédios com dose e horários; por remédio, as registradas (82
      de 90), as sem confirmação e o atraso típico; a grade de dias × doses com as pausas marcadas como pausadas; o
      rodapé obrigatório. Sem alegações clínicas.
- [ ] Testes do cálculo: doses esperadas por dia (com as pausas e as mudanças de horário), contagens e atraso típico.

**Aceite:** gerar e compartilhar o PDF offline. Comparar com o histórico após pausa, alteração de horário, remédio
removido e dose corrigida; repetir após troca de celular. Conferir paginação e o estado do resumo sem doses previstas.

## Fase 8: telefones úteis e artigos

- [ ] `content/telefones.json` com 192, 193, 190, 199, Disque 100, 136 e 188 (categoria, nome, número, se é de
      emergência). Tela por categoria, emergências primeiro, com botão de ligar.
- [ ] Seleção inicial de artigos em `content/artigos/` (título, tema, códigos de condição e data no frontmatter).
- [ ] Lista de artigos por tema, com os que combinam com as condições do perfil primeiro, e a tela de leitura.
- [ ] Publicar conteúdo novo pelo EAS Update em `preview`: baixar quando possível e mostrar na abertura seguinte,
      sem esperar a atualização para abrir o app nem recarregar automaticamente.

**Aceite:** abrir artigos e telefones em modo avião; conferir ordenação após editar o perfil, leitura com fonte
ampliada e divulgação do Premium apenas nos pontos previstos, fora das categorias de emergência.

## Fase 9: lançamento

- [ ] Passagem de acessibilidade em todos os fluxos principais: TalkBack, VoiceOver, a maior fonte do sistema (no
      Android 14 a ampliação não é linear) e o modo de letras grandes.
- [ ] Perfil completo: nome, nascimento, questionário, letras grandes, contato, Premium, estado da sincronização,
      termos e política de privacidade.
- [ ] Perfil `production` no `eas.json`, canal `production` do EAS Update e EAS Submit para as duas lojas.
- [ ] Fichas das lojas: política de privacidade, termos, página web de exclusão de conta (Google), "Segurança dos
      dados" da Play e rótulos de privacidade da Apple. Confirmar cedo se a conta Play exige teste fechado.
- [ ] Os cerca de 20 primeiros usuários por alguns dias, com Xiaomi, Samsung e Motorola entre os Android; o iOS só vai
      à App Store depois de dias sem falha de lembrete num iPhone real. Preparar os códigos de três meses de Premium.
- [ ] Conferir no ambiente hospedado login, heartbeat e ping silencioso em ambas as plataformas, webhooks reais,
      SOS e avisos de rotina. Rodar lint, tipos e os testes de regressão antes dos builds de loja.

**Aceite:** fluxos do MVP aprovados nos builds de loja de cada plataforma, com lembretes validados em aparelho
real, integrações testadas e documentos legais publicados. Completar a passagem de acessibilidade em cada plataforma.

## O que o app espera do back-end e de fora

| Fase | Dependência | Estado |
| --- | --- | --- |
| 1–2, 7 | Períodos de pausa e de horários no `SyncModel`, e `DosesBetween` usando-os no resumo e nos avisos (decisão 6) | O contrato guarda apenas a agenda e a pausa atuais |
| 3 | API acessível pelo celular (hospedagem ou túnel) | Hospedagem não escolhida |
| 3 | Credenciais do FCM e do APNs no EAS para o ping | A configurar |
| 3 | Client IDs do Google e o bundle ID da Apple em `SocialLogin` | A configurar |
| 5 | Número do app no WhatsApp e os oito modelos aprovados | Modelos não enviados |
| 6 | RevenueCat: produtos, teste, entitlement e webhook | Não configurado |
| 9 | Termos, política de privacidade e página de exclusão de conta | Não existem |
