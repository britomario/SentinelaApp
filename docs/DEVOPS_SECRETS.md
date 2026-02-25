# DevOps - Segredos e Ambientes

Documentação operacional para configuração de segredos e ambientes (staging/prod) sem versionar credenciais reais.

---

## Guia: Sair do Modo Local e Ir para Produção

O app usa **modo local** quando variáveis de ambiente não estão configuradas. Para "sair pra rua":

### 1. Instalar e configurar variáveis (React Native)

```bash
npm install react-native-config
```

Crie `.env` na raiz do projeto (copie de `.env.example` e preencha):

```
SYNC_API_BASE_URL=https://sua-api.sentinela.app
ONESIGNAL_APP_ID=seu-onesignal-app-id
REVENUECAT_ANDROID_API_KEY=sua-chave-android
REVENUECAT_IOS_API_KEY=sua-chave-ios
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
NEXTDNS_PROFILE_ID=abc123
NEXTDNS_API_KEY=seu-nextdns-api-key
DNS_VALIDATION_BLOCKED_DOMAIN=pornhub.com
```

### 2. O que cada variável controla

| Variável | Efeito ao configurar |
|----------|----------------------|
| `SYNC_API_BASE_URL` | Ações rápidas enviam comando ao dispositivo real em vez de modo local |
| `ONESIGNAL_APP_ID` | Notificações push funcionam |
| `REVENUECAT_*` | Botão "Ativar licença anual" abre fluxo de compra in-app |
| `SUPABASE_*` | Dados de família/sync (se usar Supabase) |
| `NEXTDNS_*` | Sincroniza perfil DNS familiar e regras de bloqueio no NextDNS |
| `DNS_VALIDATION_BLOCKED_DOMAIN` | Domínio usado no health-check de bloqueio DNS |
| `SENTRY_DSN` | Crash reporting em produção |

### 3. Backend para Ações Rápidas

O endpoint `POST /api/alerts/dispatch` precisa estar em produção com:

- `ONESIGNAL_REST_API_KEY` e `ONESIGNAL_APP_ID` definidos
- Deploy em Vercel/Node/etc. apontando para `SYNC_API_BASE_URL`

### 4. Rebuild após alterar .env

```bash
npx react-native start --reset-cache
npx react-native run-android   # ou run-ios
```

### 5. Alternativa sem react-native-config

Se não quiser usar react-native-config, injete variáveis em `metro.config.js` ou via script de build (ex.: `process.env.SYNC_API_BASE_URL=...` no comando de build).

---

## Variáveis de Ambiente

### Cliente (React Native / .env)

| Variável | Obrigatório | Descrição | Exemplo |
|----------|-------------|-----------|---------|
| `SUPABASE_URL` | Sim | URL do projeto Supabase | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Sim | Chave anônima Supabase | `eyJ...` |
| `SENTRY_DSN` | Não | DSN do Sentry para crash reporting | `https://xxx@sentry.io/yyy` |
| `REVENUECAT_ANDROID_API_KEY` | Sim (Android) | API Key RevenueCat Android | `appl_xxx` |
| `REVENUECAT_IOS_API_KEY` | Sim (iOS) | API Key RevenueCat iOS | `appl_yyy` |
| `ONESIGNAL_APP_ID` | Sim | App ID OneSignal | `xxx-xxx-xxx` |
| `SYNC_API_BASE_URL` | Sim (Quick Actions) | Base URL da API de sync | `https://api.sentinela.app` |
| `REALTIME_SOCKET_URL` | Não | URL do socket realtime | `wss://...` |
| `MAPS_PROVIDER` | Não | Provedor de mapas | `google` |
| `MAPS_API_KEY` | Não | Chave API mapas | - |
| `DNS_POLICY_API_BASE_URL` | Não | API de políticas DNS | - |
| `DNS_VALIDATION_BLOCKED_DOMAIN` | Não | Domínio para validar bloqueio DNS | `pornhub.com` |
| `NEXTDNS_PROFILE_ID` | Sim (NextDNS) | ID do perfil NextDNS | `abc123` |
| `NEXTDNS_API_KEY` | Sim (NextDNS) | API Key da conta NextDNS | `xxxxx` |

### Servidor (API / Vercel/Node)

| Variável | Obrigatório | Descrição |
|----------|-------------|-----------|
| `ONESIGNAL_REST_API_KEY` | Sim (dispatch) | REST API Key OneSignal |
| `ONESIGNAL_APP_ID` | Sim | App ID OneSignal |
| `REVENUECAT_WEBHOOK_SECRET` | Sim (webhook) | Webhook secret RevenueCat para validar assinatura |
| `SUPABASE_SERVICE_ROLE_KEY` | Sim (API server) | Service role para upserts server-side (obrigatório; não usar ANON_KEY) |
| `SUPABASE_URL` | Sim | URL do projeto Supabase |
| `NEXTDNS_PROFILE_ID` | Sim (DNS real) | Perfil que será aplicado aos dispositivos |
| `NEXTDNS_API_KEY` | Sim (DNS real) | Chave de autenticação da API NextDNS |

### Variáveis obrigatórias para deploy na Vercel

Configure em **Project Settings > Environment Variables** antes do deploy:

| Variável | Usado em | Nota |
|----------|----------|------|
| `SUPABASE_URL` | _supabaseServer | URL do projeto (ex.: `https://xxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | _supabaseServer | Chave service role (nunca anon) |
| `ONESIGNAL_APP_ID` | alerts/dispatch | App ID OneSignal |
| `ONESIGNAL_REST_API_KEY` | alerts/dispatch | REST API Key OneSignal |
| `REVENUECAT_WEBHOOK_SECRET` | revenuecat/webhook | Secret do webhook; sem ele o webhook aceita qualquer requisição |
| `NEXTDNS_PROFILE_ID` | dns/profile-sync | ID do perfil NextDNS |
| `NEXTDNS_API_KEY` | dns/profile-sync | API Key da conta NextDNS |

## Ambientes

### Staging

- Use `.env.staging` ou variáveis no CI (staging)
- Supabase: projeto staging
- RevenueCat: sandbox / test
- OneSignal: app de teste

### Produção

- Nunca commitar `.env` ou `.env.production` com valores reais
- Usar secrets do GitHub Actions / Vercel
- Supabase: projeto produção
- RevenueCat: production
- OneSignal: app produção

## GitHub Actions Secrets

Para builds CI que precisam de credenciais (ex: release signing):

1. **Settings → Secrets and variables → Actions**
2. Adicionar:
   - `ANDROID_KEYSTORE_BASE64` (keystore em base64)
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_PASSWORD`
   - `MATCH_PASSWORD` (iOS, se usar fastlane match)

## Checklist Operacional

- [ ] `.env.example` atualizado sem valores reais
- [ ] Secrets configurados no provedor (GitHub/Vercel)
- [ ] Staging e prod com projetos separados
- [ ] RevenueCat webhook configurado para produção
