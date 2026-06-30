# Painel de Engajamento (revenda SMM)

Sistema completo: página do cliente com filtros (rede social → tipo de
serviço → opção específica → link → quantidade → pagamento) e painel
admin (configurar fornecedor, sincronizar serviços, ativar/desativar,
editar nomes e lucro, ver pedidos e saldo).

## Estrutura

```
/api          → funções serverless (Vercel) que falam com o fornecedor e o Firebase
/lib          → helpers reutilizados pelas funções (fornecedor.js, firebase.js)
/public       → index.html (widget do cliente) e admin.html (painel admin)
```

## Passo a passo pra subir

### 1. Firebase
Você já tem outros projetos com Firebase Realtime Database — pode usar um
banco novo ou um node separado dentro de um existente. Só precisa da URL
(ex: `https://seu-projeto-default-rtdb.firebaseio.com`). As regras podem
ficar abertas pra leitura/escrita já que toda escrita sensível passa pelas
funções serverless (que ficam no servidor, não no navegador do cliente).

### 2. Subir no Vercel
- Crie um repositório no GitHub com essa pasta inteira.
- Importe o repositório na Vercel (vercel.com/new).
- Em **Settings > Environment Variables**, adicione:
  - `FIREBASE_URL` → a URL do seu Firebase
  - `ADMIN_PIN` → o PIN que você quer usar no painel admin
- Deploy.

### 3. Configurar o fornecedor
- Acesse `seu-projeto.vercel.app/admin.html`, entre com o PIN.
- Cole a URL da API (`https://measmm.com/api/v2`) e a sua key.
- Clique em **Salvar configuração**.
- Clique em **Sincronizar com o fornecedor** — isso puxa todos os serviços
  e salva no Firebase (todos entram **desativados** por padrão).

### 4. Organizar os serviços
Pra cada serviço que você quiser oferecer:
- Marque **Ativo**.
- Preencha **Rede social** (ex: `instagram`, `tiktok`) e **Tipo**
  (ex: `seguidores`, `curtidas`, `comentários`) — é isso que monta os
  filtros em cascata na página do cliente. Use sempre os mesmos termos
  (minúsculo, sem acento) pra agrupar corretamente.
- Opcionalmente, dê um nome customizado e/ou um lucro % específico
  (se deixar vazio, usa o lucro % global).

### 5. Embutir na área do cliente
O conteúdo de `public/index.html` é autocontido (HTML+CSS+JS na mesma
página, sem dependências externas). Você pode:
- Usar a página como está (iframe), ou
- Copiar o conteúdo de dentro de `#engajar-widget` direto pro HTML da
  área de cliente do seu site, ajustando só a constante `API_BASE` no
  `<script>` pra apontar pro domínio onde as funções da Vercel estão.

## Pagamento — o que falta

O fluxo de pedido tem duas etapas pensadas exatamente pra isso:
1. `POST /api/order` → cria o pedido com status `aguardando_pagamento`
   (ainda NÃO manda nada pro fornecedor).
2. `POST /api/confirm-payment` → só agora o pedido é enviado de verdade
   pro fornecedor.

Isso existe porque você não vai querer pagar o fornecedor por um pedido
que o cliente ainda não pagou pra você. Falta plugar o Mercado Pago:
- Gerar a cobrança PIX logo após o `order` ser criado (usando o
  `valorTotal` retornado).
- Configurar o webhook do Mercado Pago pra, quando o pagamento for
  aprovado, chamar `POST /api/confirm-payment` com `{ pedidoId }`.

Por enquanto, esse endpoint está protegido só por PIN, pra você testar o
fluxo manualmente direto no painel admin (dá pra criar um botão "marcar
como pago" temporário se quiser testar o fluxo ponta a ponta antes de
plugar o Mercado Pago — me chama que eu monto essa parte quando você
tiver as credenciais).

## Endpoints

| Rota | Método | Quem usa | O que faz |
|---|---|---|---|
| `/api/config` | GET/POST | admin | ler/salvar URL+key do fornecedor e lucro global |
| `/api/sync-services` | POST | admin | puxa serviços do fornecedor pro Firebase |
| `/api/admin-services` | GET/POST | admin | listar/editar serviços do catálogo |
| `/api/admin-orders` | GET | admin | listar todos os pedidos |
| `/api/balance` | GET | admin | saldo no fornecedor |
| `/api/services` | GET | cliente | lista serviços ativos (com preço final) |
| `/api/order` | POST | cliente | cria pedido (aguardando pagamento) |
| `/api/confirm-payment` | POST | admin/webhook | confirma pagamento e envia pro fornecedor |
| `/api/status` | GET | cliente/admin | consulta status do pedido (sincroniza com fornecedor) |

## Observação sobre moeda

A taxa que vem da API do fornecedor pode estar em USD (o endpoint de
saldo retorna `moeda: "USD"`). Se for o caso, adicione no Firebase em
`config/cotacaoUSDBRL` um número (ex: `5.40`) que o `/api/services` e o
`/api/order` já usam automaticamente pra converter. Se a taxa já vier na
moeda que você quer cobrar, deixe esse campo de fora.
