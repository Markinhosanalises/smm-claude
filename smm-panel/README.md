# Fênix Social — painel SMM

Frontend estático em `public/`, com HTML e JavaScript separados, API Node.js serverless em `api/` e Firebase Realtime Database acessado exclusivamente pelo Firebase Admin SDK. PIX utiliza a API de pagamentos do Mercado Pago. Node.js 22 ou superior; pnpm 11.25.0.

## Instalação e validação

```sh
pnpm install --frozen-lockfile
pnpm check
pnpm test
pnpm audit --prod
```

O lockfile registra versões exatas. Scripts de instalação de dependências ficam desativados em `.npmrc`; o painel usa as distribuições JavaScript já publicadas. DOMPurify 3.4.17 está versionado em `public/vendor/`, com sua licença, para não depender de CDN. Ao atualizá-lo, substitua também o arquivo vendorizado e execute os testes de frontend.

Os testes de backend usam um banco em memória com transações serializadas e um fornecedor simulado. Os testes das telas usam jsdom e DOMPurify reais. Eles não criam cobranças nem pedidos externos. Testes de produção, regras efetivamente instaladas e credenciais reais devem ser verificados em homologação antes da liberação.

## Implantação e migração de uma instalação existente

Esta versão muda autenticação e acesso ao banco. Faça backup privado do Realtime Database e programe uma janela de manutenção para trocar código e regras juntos. Não publique este código com o banco ainda aberto.

1. Na Vercel, use `smm-panel` como Root Directory e Node.js 22 ou superior. Instale com pnpm usando o lockfile.
2. Configure as variáveis de `.env.example`: `FIREBASE_URL`, `FIREBASE_SERVICE_ACCOUNT`, `APP_URL`, `ADMIN_PIN`, `CRON_SECRET`, `MP_WEBHOOK_SECRET` e os hosts autorizados do fornecedor. `APP_URL` precisa ser a origem HTTPS canônica, sem caminho. Use segredos aleatórios diferentes; o segredo do administrador deve ter pelo menos 12 caracteres. Nenhum segredo deve ter prefixo público.
3. Instale o conteúdo de `database.rules.json` nas regras do Realtime Database. As regras negam leitura/escrita direta para todos os navegadores e definem os índices usados pela API. O Admin SDK autentica as operações do servidor. Nunca reabra as regras para fazer o painel funcionar.
4. Com as mesmas variáveis configuradas em um terminal seguro, execute `node scripts/migrate.js` para uma prévia e `node scripts/migrate.js --apply` para converter as senhas antigas em hash, retirar chaves antigas em texto puro e converter os saldos para centavos. O script não imprime senhas nem tokens. Não mantenha a versão antiga escrevendo no banco durante a migração.
5. Rotacione o PIN antigo, a chave do fornecedor e o token do Mercado Pago se o banco esteve aberto. O token do Mercado Pago pode ser definido em `MP_ACCESS_TOKEN` ou cadastrado no admin; a variável tem preferência. A configuração antiga no banco continua compatível, mas está protegida pelas novas regras.
6. No Mercado Pago, configure eventos de **pagamento** para `https://SEU-DOMINIO/api/pagamento?action=webhook` e coloque a assinatura secreta gerada em `MP_WEBHOOK_SECRET`. Há um único webhook para pedidos e recargas. Notificações precisam de `x-signature`, `x-request-id` e `data.id`. O servidor verifica a assinatura, consulta o pagamento oficial e confere ID, referência, moeda e valor antes de creditar ou enviar o pedido.
7. Publique, faça login novamente no cliente e no admin e gere novas chaves de API. As antigas deixam de autenticar. Confira login, cadastro, catálogo, desconto, recarga, PIX, pedido com saldo, consulta, suporte e revendedores com credenciais de teste. Confira também a rejeição de acessos a outro cliente.
8. Confira o cron `/api/sync-services` e `CRON_SECRET`. Além de verificar disponibilidade do catálogo, ele recupera envios ainda não iniciados e estornos pendentes. O cron configurado roda diariamente às 06:00 UTC. O admin também pode executar a recuperação pela API descrita abaixo.

A implantação depende de acesso à Vercel, às regras/credenciais do Firebase e ao painel do Mercado Pago. Alterar arquivos no GitHub não configura esses serviços automaticamente. Reverter somente o código antigo reintroduz as falhas; mantenha regras fechadas e restaure o backup apenas após avaliar os pedidos e movimentos criados desde a migração.

## Segurança e modelo de dados

- Cookies de sessão são `HttpOnly`, `Secure` e `SameSite=Strict`. A identidade vem da sessão; `clienteId` enviado pelo navegador nunca autoriza acesso. Admin e cliente têm sessões separadas. Mutação pelo navegador exige JSON e origem compatível.
- Senhas novas usam scrypt, com salt individual, e têm de 8 a 128 caracteres. O login também migra senhas legadas para permitir uma transição controlada. A migração em lote é necessária para eliminar as senhas de clientes que não voltaram a fazer login.
- O login administrativo não aceita PIN padrão, credencial na URL nem armazenamento em localStorage. Há limitação de tentativas compartilhada no banco. O header de IP utilizado é o fornecido pela borda confiável da Vercel; se hospedar fora dela, adapte-o ao seu proxy confiável.
- Chaves de API são armazenadas como SHA-256 e aceitas somente em `Authorization: Bearer`. A autenticação verifica se o hash ainda é o atual do cliente; trocar ou revogar uma chave invalida imediatamente a anterior.
- Carteiras usam `saldoCentavos` e um registro `movimentos` por operação, alterados na mesma transação. `saldo` é mantido por compatibilidade de leitura. Não edite saldos diretamente no Firebase.
- Pedidos e recargas exigem `Idempotency-Key`. Repetir a mesma operação não duplica débito ou crédito. A numeração dos pedidos usa transação; pode ter lacunas, mas não depende de leitura/incremento separados.
- Apenas uma execução pode adquirir o estado de envio ao fornecedor. Uma recusa explícita estorna o saldo ou solicita o estorno PIX. Timeout ou resposta ambígua fica em conferência, sem reenvio nem estorno automáticos. Isso evita pagar duas vezes por uma entrega que pode ter sido aceita.
- No admin, **Conciliar envio** permite vincular um pedido já encontrado no fornecedor ou registrar que foi conferido e não foi criado, liberando o estorno. A decisão exige justificativa, é gravada no pedido e só fica disponível dois minutos após o início do envio.
- Tickets e os demais fragmentos HTML passam por DOMPurify; campos de texto do cliente são escapados. A política CSP permite scripts apenas da própria origem, sem scripts ou handlers inline. Os hosts da API do fornecedor têm lista de permissão, timeout e bloqueio de redirects.
- Tarifas por mil mantêm até oito casas decimais para preservar frações de centavo; o total final do pedido é arredondado para centavos. A área do cliente mostra uma quantidade inicial que atinge pelo menos R$ 0,01, valida link e quantidade e apresenta um resumo antes do pagamento.
- Serviços novos chegam desativados por padrão; a configuração administrativa pode ativar automaticamente os identificáveis. Preço, desconto e indisponibilidade são validados pelo servidor tanto na interface quanto na API pública.

Transações de cadastro usam a raiz do banco para reservar WhatsApp e usuário juntos. Carteiras mantêm o histórico de operações dentro da própria carteira. Essas escolhas priorizam consistência para este painel; em grande volume, planeje separar reservas e migrar o ledger para um banco transacional com índices, paginação e política de retenção. A listagem administrativa ainda carrega a coleção completa; as consultas por cliente usam índices.

## Rotas principais

| Rota | Uso |
|---|---|
| `/api/auth-cliente` | Login, cadastro, logout, sessão, login/logout administrativo, descontos e chaves |
| `/api/services` | Catálogo disponível; aplica desconto quando há sessão do cliente |
| `/api/order` | Criação autenticada de pedido; exige `Idempotency-Key` |
| `/api/carteira` | Saldo próprio, recarga PIX e crédito administrativo idempotente |
| `/api/carteira?action=historico` | Histórico autenticado de recargas |
| `/api/pagamento` | Gerar PIX próprio, receber webhook e verificar pagamento real pelo admin |
| `/api/confirm-payment` | Compatibilidade administrativa; confere pagamento no Mercado Pago |
| `/api/pedidos` | Consulta de pedidos autorizados; conciliação/recuperação pelo admin |
| `/api/tickets` | Suporte próprio e atendimento administrativo |
| `/api/revendedor` | Rota reescrita para `auth-cliente`, sem criar outra função serverless |
| `/api/public-api` | API com Bearer token para serviços, saldo, status e pedidos |

Revendedores têm uma aba própria para cadastrar clientes vinculados e acompanhar seus pedidos; também podem comprar e recarregar na área comum. O desconto do revendedor aplica-se às compras da sua própria conta. Criar um cliente vinculado não concede acesso à carteira ou à sessão desse cliente.

Para recuperação administrativa: `POST /api/pedidos` com `{"action":"recuperar"}`, sessão admin e `Content-Type: application/json`. Só pedidos cujo débito está registrado, pagamentos confirmados ou estornos pendentes são retomados. Envios com resultado desconhecido exigem conciliação no admin.

Exemplos da API pública ficam em `/api-docs.html`. Nas tentativas de um mesmo pedido, preserve a chave de idempotência; use uma nova apenas para uma compra nova. Status `estornado` significa que houve recusa e devolução; `revisao_fornecedor` exige conferência, não uma nova compra automática.

Referências de implementação: [transações Firebase](https://firebase.google.com/docs/database/admin/save-data), [assinatura dos webhooks Mercado Pago](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro/additional-content/notifications/webhooks), [DOMPurify](https://github.com/cure53/DOMPurify).

## Catálogo completo e formulários

A importação conserva os dados originais para o administrador e apresenta nomes e categorias traduzidos na área do cliente, sob a marca Fênix Social. Separadores, itens de teste, nomes internos como `space5`, valores inválidos e modalidades desconhecidas ficam fora da venda. `config.ativarNovosServicos=true` permite ativar novos serviços identificáveis nas sincronizações manuais, preservando alterações administrativas e margens individuais. O cron diário confere disponibilidade; a sincronização manual atualiza preços e dados do catálogo.

A ordem padrão `recursos` prioriza a disponibilidade de reposição e cancelamento, seguida de preço. Esses recursos vêm dos campos da API; a classificação não comprova qualidade, velocidade ou resultado. Prazos e alegações no título são informações anunciadas, não garantias.

O módulo compartilhado `public/service-forms.js` valida as 13 modalidades no navegador e no servidor. Comentários e listas calculam a quantidade pelas linhas; pacotes cobram uma tarifa única. Acompanhamentos exigem quantidade por publicação, limite de publicações futuras e antigas (até 100 no total), espera e data final; o valor máximo é cobrado antecipadamente e não há renovação automática. Entregas parceladas multiplicam a quantidade pelo número de parcelas. O total é arredondado para centavos e pedidos positivos têm mínimo de R$ 0,01.

O envio ao fornecedor usa somente os parâmetros documentados de cada modalidade. Pedidos antigos conservam a identificação idempotente anterior; pedidos novos armazenam a especificação e os parâmetros normalizados para recuperação sem mudança do conteúdo. Os testes de compra usam um fornecedor simulado, sem gastos reais.
