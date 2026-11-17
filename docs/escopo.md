# Escopo da Central Melhor Idade

O que entra no MVP e o que fica para depois. A stack e a arquitetura estão em [arquitetura.md](arquitetura.md), e a
ordem de entrega do app está no [plano do front-end](plano-app.md).

## Produto

Aplicativo para ajudar pessoas idosas a organizar a rotina de medicamentos, consultar informações úteis e pedir ajuda a um familiar de confiança. O lançamento será em Android e iOS, em português do Brasil.

O app vale por si só para a pessoa idosa, que pode usá-lo e assinar o Premium sem nenhum familiar vinculado. O vínculo com um contato de confiança é opcional.

Restrições que guiam as escolhas: um único desenvolvedor e custo baixo.

## MVP

### Medicamentos

- Cadastrar e editar medicamentos e seus horários fixos, com um campo opcional de texto livre para a dose e o modo de tomar (por exemplo, "50 mg, 1 comprimido"). Permitir pausar os lembretes.
- Agendar lembretes no aparelho, com as ações **Tomei** e **Lembrar depois** (que adia **10 minutos**). O lembrete e o registro da tomada funcionam sem internet.
- Mostrar o próximo horário na tela **Hoje**, com os estados **Pendente**, **Registrado** e **Sem confirmação**. O histórico mostra quando a tomada foi registrada e permite corrigir um toque acidental.
- O aparelho mostra **Sem confirmação** com o mesmo prazo de **1 hora** que o servidor usa nos avisos ao familiar: é um número só, copiado no app e no servidor. A tela não diz se o familiar foi avisado; isso depende também do contato recente com o celular.

### Relatório para a consulta

- **Lista de remédios em uso (grátis).** Nome, dose e horários, para mostrar ao médico ou num pronto-socorro.
- **Relatório de regularidade (Premium).** Um PDF de um período escolhido (30, 60 ou 90 dias) com:
  - os remédios em uso, com dose e horários;
  - por remédio, as doses registradas no período (por exemplo, 82 de 90), as sem confirmação e o atraso típico em relação ao horário (a mediana do atraso das doses registradas);
  - uma grade de dias × doses, com os períodos de lembrete pausado marcados como pausados, e não como esquecimento;
  - no rodapé: "Registros feitos pela própria pessoa no aplicativo. Um registro indica que a dose foi marcada como tomada, não comprova a ingestão."
- No grátis, a tela mostra um resumo do período (por exemplo, "Você registrou 91% das doses nos últimos 30 dias") e oferece o Premium para gerar o PDF completo.
- O percentual conta sobre as doses esperadas no período, sem os dias com lembrete pausado e sem as doses ainda dentro do prazo de 1 hora.
- O PDF é gerado no próprio celular, funciona sem internet e é compartilhado pelo menu do sistema (WhatsApp, e-mail ou impressão).
- Sem alegações clínicas: o app não fala em "monitoramento" nem em "controle do tratamento".

### Avisos ao familiar pelo WhatsApp

Tudo o que sai pelo WhatsApp é do Premium, porque cada mensagem custa: o vínculo, os avisos de rotina (resumo diário, dose sem confirmação, celular sem contato e pausa por abandono), o SOS pelo WhatsApp e o lembrete de aniversário. No grátis, o contato de confiança serve para ligar e mandar SMS pelo próprio celular.

- A pessoa pode cadastrar um contato de confiança (nome, telefone e parentesco), escolher quais medicamentos quer compartilhar e revogar o acesso. O familiar não instala o aplicativo: ele recebe os avisos pelo WhatsApp.
- **Parentesco.** O cadastro do contato tem o parentesco do ponto de vista do familiar (pai, mãe, avô, avó, tio, tia, amigo, outro). Os avisos usam esse campo: "Sua mãe, Maria, pediu ajuda".
- **Vínculo do familiar.** O app mostra um link ou QR code que abre o WhatsApp com uma mensagem pronta para o número do aplicativo, com um código de vínculo. Quando o familiar envia a mensagem, o servidor registra o aceite exigido pela Meta, confirma o número e vincula o familiar à pessoa. O familiar pode responder **PARAR** a qualquer momento para deixar de receber avisos.
- Se uma dose de um medicamento compartilhado não for registrada até **1 hora** depois do horário, ela passa a **Sem confirmação** e o familiar recebe um aviso de **dose sem confirmação**.
- Todos os dias às **20h**, o familiar recebe um **resumo diário** dos medicamentos compartilhados. O resumo cobre as doses das 24 horas anteriores e mostra as registradas, as sem confirmação e as ainda dentro do prazo. Tocar em **Tomei** não gera um aviso por dose.
- **Lembrete de aniversário.** No dia do aniversário da pessoa, o familiar recebe "Lembrete: hoje é aniversário da sua mãe, Maria". A Meta define a categoria do modelo na aprovação; um lembrete de aniversário provavelmente será classificado como marketing, a cerca de R$ 0,32 por mensagem. Como é uma mensagem por ano por familiar, o custo é desprezível. O texto do vínculo menciona que o familiar também recebe lembretes como este.
- Os horários seguem o fuso do aparelho da pessoa idosa.

#### Celular sem conexão e abandono do app

Regras para evitar uma enxurrada de avisos. Os números são valores iniciais para o lançamento e podem ser ajustados com o uso real.

- **O servidor decide se a dose ficou sem confirmação**, com a mesma regra no Android e no iOS. Ao fim do prazo de 1 hora sem receber o **Tomei**, o servidor só avisa o familiar se teve contato com o celular nas **6 horas** anteriores. Sem contato recente, nenhum aviso sai, e a dose aparece só no resumo diário.
- **Tomei sem internet.** O registro fica na fila do celular e é enviado quando a conexão voltar. Se chegar até as 20h, entra no resumo como registrado. Como o celular pode ter perdido a conexão pouco antes da dose, o aviso diz "não recebemos a confirmação", e não "não tomou".
- **O servidor vigia o contato com o celular.** O app envia um sinal de vida ao abrir, a cada evento e periodicamente em segundo plano, quando o sistema permitir. Depois de **12 horas** sem sinal (24 horas no iOS), o servidor tenta um ping por notificação push. Se o celular não responder, o familiar recebe **um único** aviso de celular sem contato, que só se repete depois que o celular voltar a se comunicar. Nesse período, o resumo diário informa que não há dados, em vez de listar as doses como sem confirmação. Se o ping mostrar que o app foi desinstalado ou ficou com as notificações desligadas (o que também cala os lembretes), o aviso único diz isso no lugar do de celular sem contato.
- **Pausa por abandono.** Depois de **3 dias seguidos** sem nenhuma dose registrada, os avisos de dose sem confirmação e o resumo diário são pausados, e o familiar recebe um aviso único informando a pausa. Os avisos voltam sozinhos no próximo **Tomei**.
- **Teto diário.** Cada familiar recebe no máximo **3 avisos de dose sem confirmação por dia**. Os demais aparecem só no resumo. Doses no mesmo horário geram um único aviso.
- Com essas regras, o pior caso por familiar é de um resumo e três avisos por dia, e cai para zero depois de três dias de abandono.

### Botão SOS

- Exibir um botão **SOS** na tela inicial, em todos os planos.
- **Grátis.** O SOS liga para o contato de confiança ou abre o SMS com o texto pronto, pelo plano do próprio celular, sem custo para o app.
- **Premium.** O pedido de ajuda também sai automaticamente pelo WhatsApp para o contato vinculado.
- Mostrar o status do envio, inclusive quando houver falha, e oferecer um atalho para ligar ao contato.

### Telefones úteis e artigos

- Oferecer uma lista de telefones por categoria, com botão para ligar e acesso ao contato de confiança.
- Oferecer uma seleção inicial de artigos curtos, organizados por tema e fáceis de ler no celular. Cada artigo tem etiquetas por condição de saúde, e a tela mostra primeiro os que combinam com o perfil da pessoa.
- Publicar a seleção inicial de telefones e artigos junto com o aplicativo. O conteúdo funciona sem internet.
- **Telefones iniciais.** Os números nacionais: 192 (SAMU), 193 (Bombeiros), 190 (Polícia), 199 (Defesa Civil), Disque 100 (Direitos Humanos, que recebe denúncias de violência contra a pessoa idosa), 136 (Disque Saúde) e 188 (CVV). Números locais ficam para quando houver telefones por cidade.
- **Sem interface de administração no MVP.** O próprio desenvolvedor escreve e publica o conteúdo como arquivos no repositório: um Markdown por artigo (com título, tema, condições de saúde e data) e um JSON de telefones (com categoria, nome, número e se é de emergência). Os textos da divulgação do Premium seguem o mesmo caminho. Para publicar, uma atualização pelo ar (EAS Update) leva o conteúdo novo aos aparelhos sem passar pela revisão das lojas: o app baixa a atualização ao abrir ou em segundo plano e a mostra na abertura seguinte.

### Acessibilidade

- Usar controles grandes, alto contraste, texto ampliável e suporte ao TalkBack e ao VoiceOver nos fluxos principais.

### Configuração inicial

- O aplicativo roda apenas no celular da pessoa idosa. Um familiar pode ajudar presencialmente a fazer a configuração. Não há assistência remota no MVP.
- Ordem: login, nome e data de nascimento, questionário de saúde (que pode ser pulado), medicamentos, contato de confiança (opcional) e permissões.

### Conta e perfil

- **Login social obrigatório.** Na configuração inicial: "Entrar com Google" no Android; "Entrar com Apple" e "Entrar com Google" no iPhone, porque a Apple exige o login dela sempre que o app oferece o do Google. Não há senha.
- **A conta identifica a pessoa em qualquer celular.** Ao trocar de celular, entrar com a mesma conta restaura os medicamentos, os horários, o histórico, o contato de confiança, o perfil e a assinatura.
- **Sincronização.** Todos os dados do app vão para o servidor quando houver conexão, e o app continua funcionando sem internet. Há um aparelho ativo por conta: ao entrar em outro celular, o anterior para de sincronizar.
- **E-mail.** Quem entra pela Apple com "Ocultar meu e-mail" entrega um endereço de redirecionamento, não o e-mail real.
- **Nome.** Logo depois do login, já preenchido com o nome da conta Google ou Apple, para a pessoa confirmar ou dizer como prefere ser chamada. Os avisos ao familiar usam esse nome: "sua mãe, Maria".
- **Data de nascimento.** Na mesma tela do nome, com campos grandes de dia, mês e ano (o calendário do sistema é difícil para esse público). No dia do aniversário, o app mostra uma notificação de parabéns.
- **Questionário de saúde.** Logo depois da data de nascimento, numa tela só, com botões grandes e um **Pular** bem visível. Se a pessoa pular, um cartão na tela **Hoje** volta a pedir **3 dias** depois. Tudo fica editável no Perfil.
  - **Condições** (múltipla escolha): pressão alta, diabetes, colesterol alto, problema no coração, artrose ou artrite, osteoporose, tireoide, depressão ou ansiedade, problema de memória, asma ou bronquite crônica, AVC (derrame), problema nos rins, outra (texto livre) e nenhuma.
  - **Três perguntas de sim ou não:** mora sozinho(a)? Caiu nos últimos 12 meses? Tem dificuldade para enxergar? A última pode ligar o modo de letras grandes e alto contraste.
  - **Usos:** artigos sugeridos, conhecer a base de usuários, pesquisa para a futura linha de suplementos e contexto para o futuro chat com IA. A resposta sobre quedas mede o interesse no [spike de detecção de queda](#spike-detecção-de-possíveis-quedas).
- **Excluir conta.** Dentro do app, como a Apple e a Google exigem. A Google também exige um link na web para pedir a exclusão. Excluir a conta apaga os dados do servidor.

### Planos e cobrança

A assinatura **Premium** é comprada dentro do app, pela Apple e pela Google, através do RevenueCat. Quem compra é quem está com o celular: a própria pessoa idosa ou o familiar que ajuda na configuração.

**Regra:** tudo o que tem custo por uso vai para o Premium. Hoje isso é todo envio pelo WhatsApp; no futuro, o chat com IA. O servidor e a sincronização são custos fixos e ficam no grátis, porque os dados da base são o ativo.

| | Grátis | Premium |
|---|---|---|
| Lembretes, **Tomei** e histórico | ✓ | ✓ |
| Lista de remédios em uso | ✓ | ✓ |
| SOS por ligação ou SMS do próprio celular | ✓ | ✓ |
| Contato de confiança para ligar e mandar SMS | ✓ | ✓ |
| Telefones úteis e artigos | ✓ | ✓ |
| Vínculo do familiar pelo WhatsApp | | ✓ |
| SOS automático pelo WhatsApp | | ✓ |
| Avisos de rotina ao familiar (resumo, dose sem confirmação, sem contato, abandono) | | ✓ |
| Lembrete de aniversário ao familiar | | ✓ |
| Relatório de regularidade em PDF | | ✓ |
| Sem anúncios (quando houver anúncios) | | ✓ |

- **Por que dentro do app.** Quando o próprio usuário paga por recursos usados no app, a Apple e a Google exigem a cobrança delas. Também é o caminho mais rápido para um desenvolvedor só: as lojas cuidam do pagamento, da renovação e do cancelamento, e o RevenueCat cuida das duas lojas com um SDK só e avisa o servidor por webhook. O custo é a comissão das lojas, de 15% para assinaturas de quem fatura pouco.
- **A assinatura acompanha a conta.** O RevenueCat usa a conta do app como usuário, então o Premium vale em qualquer celular em que a pessoa entrar. **Restaurar compras** continua disponível para os casos em que a compra foi feita antes do login.
- **O servidor libera os envios.** Nenhuma mensagem pelo WhatsApp sai sem o Premium ativo informado pelo RevenueCat.
- **Fim da assinatura.** Quando o Premium acaba, os envios param e o vínculo fica guardado. Se a pessoa voltar a assinar, os avisos recomeçam sem precisar vincular de novo.
- **Familiar que paga.** No iPhone, a compra fica no Apple ID do celular da pessoa idosa, ou é compartilhada pelo Compartilhamento Familiar da Apple. Se isso atrapalhar as vendas, o pagamento pelo site para familiares pode entrar depois, também pelo RevenueCat, sem criar uma segunda assinatura.
- Termos de uso e política de privacidade são exigidos pelas duas lojas.

#### Espaços de anúncio

No plano grátis, o app reserva espaços para anúncios. No MVP, eles mostram só a divulgação da própria marca, como o Premium ("Seu filho pode receber um resumo diário das suas doses. Teste 14 dias") e, no futuro, a linha de suplementos. A divulgação própria não precisa de rede de anúncios nem do aviso de rastreamento da Apple. Os anúncios de rede entram depois (ver [Evoluções após o MVP](#evoluções-após-o-mvp)).

- **Onde:**
  - no fim de cada artigo, depois do texto e antes do "Voltar";
  - na lista de artigos, um cartão a cada 4 ou 5 artigos;
  - no fim da lista de telefones úteis, só nas categorias que não são de emergência (serviços, órgãos públicos).
- **Onde nunca:** lembretes, **Tomei**, **Hoje**, histórico, SOS, telefones de emergência, cadastro de remédios e configuração inicial; nenhum anúncio em tela cheia, nem na abertura do app; nada de anúncio em notificação, que as lojas proíbem.

#### Preço e teste

- **R$ 19,90 por mês ou R$ 159,90 por ano.** O anual equivale a cerca de R$ 13,33 por mês, uns 33% de desconto, e traz dinheiro adiantado e menos cancelamentos. O preço fica no topo da faixa do brainstorming original; baixar depois é mais fácil que subir.
- **Teste de 14 dias pela loja, com cartão.** É a oferta introdutória gratuita da Apple e da Google: a pessoa cadastra o cartão ao começar o teste, e a cobrança é automática no fim. Só quem já cadastrou o cartão gera custo de WhatsApp, o que respeita a regra de que o que custa é pago. A loja garante um teste por conta.
- **Aviso antes do fim do teste.** Dois dias antes do fim, uma notificação no app informa a data e o valor da primeira cobrança, a partir da data de expiração que o RevenueCat informa.
- **Primeiros usuários.** Os cerca de 20 conhecidos ganham 3 meses de Premium com códigos promocionais da Apple e da Google, em troca de retorno sobre o app.

| Plano mensal | Por mês |
|---|---|
| Preço | R$ 19,90 |
| Comissão das lojas (15%) | − R$ 2,99 |
| WhatsApp (resumo diário e avisos, com familiar vinculado) | − ~R$ 1,40 |
| RevenueCat (grátis até US$ 2.500 por mês) | R$ 0 |
| **Antes de impostos e servidor** | **~R$ 15,51** |

Os impostos dependem da forma de faturamento (MEI ou Simples) e devem ser confirmados com um contador.

## Lançamento

O objetivo é faturar o quanto antes. Por isso, o app vai direto para as lojas, sem teste fechado formal.

- **Android:** publicação direta na Play Store, assim que o app estiver pronto.
- **iOS:** desenvolvido em paralelo com o Android, mas publicado na App Store só depois de testado adequadamente em iPhone real, com alguns dias de uso real sem falha de lembrete. A revisão da Apple não verifica se a notificação dispara no horário com o celular bloqueado. O iOS é prioridade porque concentra muitos clientes em potencial com maior disposição para pagar.
- **Primeiros usuários.** Cerca de 20 pessoas, entre conhecidos e familiares, usam o app em produção por alguns dias antes de começar a divulgação. Elas encontram os problemas antes dos clientes pagantes.
- **Ordem do desenvolvimento.** Começar pelo motor de agenda e testá-lo em aparelhos reais desde a primeira semana, antes das telas. O maior risco está nos lembretes, não na interface. O aparelho principal de desenvolvimento é Android.

### Testes no iOS sem iPhone próprio

No Windows não há simulador de iPhone. Até ter um iPhone próprio:

- **TestFlight em iPhones de conhecidos.** O EAS gera o build e o envia ao TestFlight a partir do Windows. Um build por semana para uma ou duas pessoas com iPhone. A revisão do TestFlight não atrasa a da App Store.
- **Tela de teste de lembrete.** O app agenda uma notificação para dali a um minuto, e a pessoa confere com o app fechado e o celular bloqueado se o lembrete tocou e se o **Tomei** foi registrado.
- **Sentry desde o primeiro build**, para receber os erros dos aparelhos sem tê-los em mãos.
- **iPhones na nuvem**, como BrowserStack e AWS Device Farm, servem para conferir telas e fluxos, mas não para testar notificações com o app fechado.
- Um iPhone usado de entrada (iPhone 11 ou posterior roda o iOS atual) elimina a dependência de terceiros.

## Decisões em aberto

- **Conta de desenvolvedor na Play.** Contas pessoais criadas depois de 13/11/2023 só publicam em produção depois de um teste fechado com pelo menos 12 testadores por 14 dias seguidos. Para publicar direto, é preciso uma conta de organização, com CNPJ e número D-U-N-S (gratuito, mas leva alguns dias), ou uma conta pessoal criada antes dessa data. A conta de organização da Apple também pede D-U-N-S, então vale tirar um número só para as duas lojas.
- **Faixa gratuita do RevenueCat.** Fontes de 2026 indicam que é gratuito até US$ 2.500 de receita por mês e cobra 1% acima disso, calculado sobre a receita bruta. As fontes divergem sobre se o 1% incide sobre tudo ou só sobre o excedente. Confirmar em revenuecat.com/pricing. A meta da fase A (R$ 3 mil a 10 mil por mês) fica dentro da faixa gratuita. Se um dia o custo pesar, a integração direta com as lojas (`expo-iap`) substitui o `Anticorruption.RevenueCat` sem mexer no domínio.

## Custos do WhatsApp

Levantamento de 16/11/2026, com base na [página oficial de preços da Meta](https://developers.facebook.com/docs/whatsapp/pricing). O valor por mensagem para o Brasil vem de fontes secundárias e deve ser confirmado na tabela em BRL da Meta antes de fechar preços.

- **Modelo de cobrança.** Desde julho de 2025, a Meta cobra por mensagem entregue. Todos os avisos do app (resumo diário, dose sem confirmação, celular sem contato e SOS) são mensagens de modelo da categoria **utilidade**.
- **Valor no Brasil.** Utilidade custa cerca de **US$ 0,0068, ou R$ 0,035 por mensagem**, na tabela vigente desde 1/10/2026. Há descontos por volume.
- **Sem gratuidade para utilidade.** Desde 1/10/2026, utilidade é cobrada mesmo dentro da janela de 24 horas. Só as respostas livres (mensagens de serviço) têm 1.000 envios grátis por mês por número.
- **Integração direta.** Integrar com a Cloud API da Meta pelo próprio backend .NET evita a margem de intermediários como Twilio, Zenvia e Blip.
- **Requisitos.** Conta no Meta Business, um número de telefone exclusivo para o app (que não esteja em uso no WhatsApp comum), cartão cadastrado e modelos de mensagem aprovados pela Meta. Os modelos devem ser só informativos: conteúdo promocional faz a mensagem ser reclassificada como marketing, que custa cerca de 9 vezes mais. Ainda é preciso verificar se a verificação do negócio exige CNPJ.

Estimativa com um contato por pessoa, três doses compartilhadas por dia e cerca de 10% das doses sem confirmação:

| Cenário | Mensagens por mês | Custo por mês |
|---|---|---|
| **Primeiros usuários (20 pessoas), resumo diário (escolhido)** | ~800 | **~R$ 28** |
| **300 assinantes, resumo diário (escolhido)** | ~12.000 | **~R$ 420 (~7% de R$ 5.970 de receita)** |
| 300 assinantes, aviso por dose (descartado) | ~30.000 | ~R$ 1.050 (~18% da receita) |
| 300 assinantes, só exceções (alternativa mais barata) | ~2.700 | ~R$ 95 (~2% da receita) |

Os pedidos de SOS têm custo desprezível. O que pesa é a frequência dos avisos de rotina; por isso a confirmação de tomada vai no resumo diário, e não um aviso por dose.

Nos EUA a mensagem de utilidade custa cerca de metade do valor do Brasil, mas isso não reduz o custo: a Meta cobra pelo país do número de quem recebe, então familiares com número brasileiro pagam a tarifa do Brasil.

## Spike: detecção de possíveis quedas

Ficou fora do MVP, que prioriza o aviso de dose sem confirmação. Entra em uma versão futura se passar nos testes abaixo.

- Permitir que a pessoa ative ou desative o monitoramento pelos sensores do celular.
- Ao detectar uma possível queda, emitir um alerta no aparelho e abrir uma janela para cancelar ou pedir ajuda imediatamente. Se o prazo terminar sem resposta, enviar ao contato de confiança um aviso identificado como **possível queda**.
- Testar em aparelhos reais com a tela bloqueada e o app fora de primeiro plano. Medir falsos alarmes em movimentos cotidianos, consumo de bateria e chegada do aviso ao contato. Definir a duração da janela de cancelamento. O Android restringe a leitura contínua de sensores em segundo plano. [Documentação de sensores do Android](https://developer.android.com/develop/sensors-and-location/sensors/sensors_overview)

## Evoluções após o MVP

- Detecção de possíveis quedas, se o spike for aprovado.
- Check-in diário de bem-estar e compartilhamento de localização.
- Mais contatos, estoque e reposição de medicamentos e agenda de consultas.
- **Gestão editorial.** Entra quando outra pessoa passar a escrever (por exemplo, um profissional de saúde parceiro que não usa git), quando o ritmo de publicação pedir agendamento ou quando houver telefones por cidade, que dependem da localização e precisam vir do servidor. Será um admin próprio e simplificado, sem CMS pronto, e o app passa a buscar o conteúdo pela API.
- Comentários, eventos, ofertas e enquetes.
- Outros idiomas.
- **Anúncios de rede no plano grátis.** Entram quando houver uma base de usuários grátis que justifique, porque anúncio só rende com volume. Até lá, os mesmos espaços mostram a divulgação do Premium (ver [Espaços de anúncio](#espaços-de-anúncio)). O Premium remove os anúncios.
  - Rede: AdMob, com `react-native-google-mobile-ads`, que funciona com o build do Expo.
  - Formato nativo, com o visual do app e o rótulo "Anúncio", em vez de banner.
  - Categorias sensíveis bloqueadas no painel (empréstimos, apostas, finanças e saúde), porque idosos são alvo frequente de golpes.
  - Anúncios não personalizados, que dispensam o aviso de rastreamento da Apple, mais uma tela confusa para o idoso, mesmo pagando menos.
  - Para testar depois: o rodapé da tela **Hoje** (a tela mais vista, mas onde fica o **Tomei**), só depois de testes com usuários reais mostrarem que não há toques acidentais; e o anúncio com recompensa ("veja um vídeo para gerar o relatório uma vez"), que paga mais, mas compete com o Premium.
- **Linha de suplementos da marca.** Os dados do perfil servem desde já como pesquisa de mercado, de forma agregada (por exemplo, quantos usuários têm osteoporose). Regras para quando a loja entrar:
  - sugestão personalizada só com checagem de interação com os remédios cadastrados, revisada por farmacêutico, e sempre com "converse com seu médico antes", porque alguns suplementos interferem na ação de remédios comuns;
  - nenhum anúncio de suplemento como tratamento ou prevenção de doença, conforme as regras da Anvisa;
  - a loja fica numa área separada, nunca nos lembretes, no histórico ou no SOS;
  - produtos físicos podem usar checkout próprio: as lojas de apps não exigem a cobrança delas nem cobram comissão sobre eles.
- **Chat com IA (Premium).** Conversa com a pessoa idosa, de preferência por voz, inclusive sobre o cadastro e o histórico de medicamentos. Entra depois que o fluxo principal estiver funcionando. Como cada conversa custa dinheiro, é só para assinantes ou tem limite. Regras:
  - nada de orientação médica: o chat não sugere dose, não troca remédio e não interpreta sintomas; diante de algo grave, encaminha para o SOS ou para um telefone útil;
  - só APIs que não treinam com os dados enviados, como no RevoSolutions.TVP;
  - reaproveitar a integração de IA do RevoSolutions.TVP (`Microsoft.Extensions.AI`, `Anticorruption.Claude` e `Anticorruption.OpenAI`).

## Brainstorming original

Cópia integral do resumo da conversa “App Mobile Terceira Idade”, incluindo as hipóteses iniciais de produto, lançamento e monetização. As decisões vigentes para a primeira versão estão em [MVP](#mvp).

> ### 🎯 Objetivo Inicial
> Você quer desenvolver um **app mobile para Android e iOS**, aproveitando seu stack atual:
>
> - Backend: **.NET / C#**
> - Frontend: **React**
> - Objetivo inicial: **aprender o processo completo de criar e publicar um app**, começando pela Play Store.
> - Idiomas: **Português e Inglês** desde a primeira versão.
>
> ---
>
> ## 🛠 Stack Recomendado
>
> ### Frontend Mobile
> **React Native + Expo**
>
> Motivos:
> - Aproveita seu conhecimento em React.
> - Curva de aprendizado menor.
> - Facilita geração de builds Android e iOS.
> - Permite publicar rapidamente na Play Store.
>
> ### Backend
> **ASP.NET Core Web API**
>
> Stack natural para você.
>
> ---
>
> ## 📱 Publicação
>
> ### Google Play Store
> - Conta Google Play Console: taxa única de US$ 25.
> - Publicação via arquivo `.aab`.
> - Primeiro release pode ser em Internal Testing.
>
> ### Apple App Store
> - Conta Apple Developer: US$ 99/ano.
> - Publicação posterior usando TestFlight e App Store Connect.
>
> ---
>
> ## 🌎 Multi-idioma
>
> Você pretende lançar em:
> - Português
> - Inglês
>
> O app pode:
> - Detectar idioma do aparelho automaticamente.
> - Ter textos separados via i18n (`pt.json`, `en.json`).
>
> A Play Store também permite ficha do aplicativo em múltiplos idiomas.
>
> ---
>
> # 💡 Ideia do Produto
>
> ### MVP Inicial
>
> - Botão de ajuda/emergência
> - Telefones úteis
> - Artigos para terceira idade
> - Detecção de queda (giroscópio/acelerômetro)
>
> ### Evolução futura
>
> - Chatbot
> - Compartilhamento de localização
> - Lembretes de medicação
> - Check-in diário
> - Notificações para familiares
>
> ---
>
> ## ⭐ Funcionalidades sugeridas
>
> As mais interessantes para começar:
>
> ### Check-in diário
> Pergunta:
>
> > "Está tudo bem hoje?"
>
> Respostas:
> - ✅ Estou bem
> - ⚠️ Preciso de ajuda
>
> Se não responder:
> - Notifica familiar.
>
> ### Compartilhamento de localização
> Botão único:
> - Envia localização por WhatsApp/SMS.
>
> ### Modo acessível
> - Fontes grandes
> - Alto contraste
> - Botões grandes
>
> ### Leitura em voz alta
> - Artigos com Text-to-Speech.
>
> ---
>
> # 💰 Monetização
>
> ## O que evitar
>
> - Muitos anúncios.
> - Intersticiais agressivos.
>
> ---
>
> ## Modelos recomendados
>
> ### 1. Assinatura Premium
>
> Grátis:
> - Botão ajuda
> - Telefones úteis
>
> Pago:
> - Check-in diário
> - Histórico
> - Notificações para familiares
> - Detector de queda
> - Chatbot
>
> Faixa sugerida:
> - R$ 9,90 a R$ 19,90/mês
>
> ---
>
> ### 2. Plano Familiar (mais promissor)
>
> Quem paga geralmente é:
> - Filho
> - Filha
> - Cuidador
>
> Exemplo:
> - 1 idoso
> - Até 3 familiares
>
> Ticket maior.
>
> ---
>
> # 📊 Projeções Financeiras
>
> ## Brasil
>
> 10.000 downloads
> → 6.000 usuários ativos
> → 5% conversão
>
> ≈ 300 assinantes
>
> 300 × R$ 15
>
> ≈ **R$ 4.500/mês**
>
> ---
>
> ## Crescimento
>
> 100.000 downloads
> → 60.000 ativos
> → 5% conversão
>
> ≈ 3.000 assinantes
>
> 3.000 × R$ 15
>
> ≈ **R$ 45.000/mês**
>
> ---
>
> # 🚀 Estratégia de Crescimento
>
> ### Não vender para o idoso.
>
> Vender para o familiar.
>
> Posicionamento sugerido:
>
> > "Tranquilidade para quem tem pais idosos morando sozinhos."
>
> ---
>
> ### Canais iniciais
>
> - TikTok
> - Instagram Reels
> - Facebook
> - Grupos de cuidadores
> - Grupos de bairro
> - Igrejas
> - Condomínios
>
> ---
>
> ### SEO da Play Store
>
> Palavras-chave:
> - segurança para idosos
> - botão emergência
> - idoso sozinho
> - alerta familiar
>
> ---
>
> # 🧭 Estratégia Final Definida
>
> ### Fase A (agora)
> Side project rentável
>
> Objetivo:
> - Aprender mobile
> - Publicar app
> - Conseguir primeiros usuários
> - Validar demanda
>
> Meta:
> - R$ 3k–10k/mês
>
> ---
>
> ### Fase B (se validar)
>
> Transformar em produto sério
>
> Adicionar:
> - Dashboard web (React)
> - Backend robusto (.NET)
> - Plano familiar
> - Notificações avançadas
> - Crescimento pago
>
> Meta:
> - R$ 20k–50k+/mês
>
> ---
>
> ### Próximo Passo Recomendado
>
> Antes de pensar em detector de queda ou chatbot:
>
> 1. Instalar Node.js.
> 2. Criar um projeto Expo.
> 3. Fazer uma tela simples.
> 4. Gerar um `.aab`.
> 5. Criar conta na Play Store.
> 6. Publicar um app de teste.
>
> Isso completa o ciclo "sou um desenvolvedor mobile publicado", que é o objetivo imediato que você mencionou.

## Referências

- [Projeto CMI, proposta original no Drive](https://docs.google.com/document/d/1EJZttHvj-Vtuz54iPGfFKdZDEj3mHm_4JBoEDFC3Npk/edit)
- [Proposta do app de 2014](https://docs.google.com/document/d/0B7cIdP7OCManaEtGVnZTcEQyLVk/edit?resourcekey=0-7wtVpYqF1kSAod1w4WETfg)
- [Primeiro brainstorming sobre o app](https://chatgpt.com/c/69a6822e-c604-832f-9952-dd3195214019)
