# Go-Live Piloto — Passo a passo

Este guia permite ver o app real contra Supabase e API reais (versão piloto). Para publicação nas lojas, use o [guia completo](GO_LIVE_PLAYSTORE_APPSTORE.md).

---

## Antes de rodar o app

Execute a checagem de ambiente:

```bash
npm run check:env
```

Corrija qualquer variável faltando antes de continuar.

---

## Passo 1 — Supabase

1. Crie um projeto no [Supabase](https://supabase.com) (ex.: `sentinela-pilot`).
2. Ative **Auth** (Google + Apple) e **Realtime**.
3. Rode as migrations no projeto:
   - No terminal: `supabase link` (se usar CLI) e depois `supabase db push`, **ou**
   - No dashboard: SQL Editor -> execute o conteúdo de `supabase/migrations/007_go_live_tables.sql`.
4. Confirme que o projeto aplicou as policies da migration 007 (RLS básico para tabelas de location, DNS e family state).
5. Anote e guarde:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (somente backend/API)

Critério para avançar:

- `supabase db push` sem erro (ou SQL executado com sucesso no dashboard).
- Tabelas `child_location_state`, `child_dns_policy`, `family_children`, `family_premium_state`, `family_pairing_state` visíveis no projeto.

---

## Passo 2 — API (Vercel)

1. Faça deploy da pasta `api/` no [Vercel](https://vercel.com) (importe o repositório e defina o root em `api/` ou o projeto conforme sua estrutura).
2. Configure no projeto Vercel as variáveis de ambiente:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ONESIGNAL_APP_ID`
   - `ONESIGNAL_REST_API_KEY`
   - `REVENUECAT_WEBHOOK_SECRET`
   - `NEXTDNS_PROFILE_ID`
   - `NEXTDNS_API_KEY`
3. No RevenueCat Dashboard (Webhooks), configure o endpoint de webhook e envie o header:
   - `Authorization: Bearer <REVENUECAT_WEBHOOK_SECRET>`
4. Faça o deploy e valide os endpoints:
   - `POST /api/alerts/dispatch`
   - `POST` / `GET /api/realtime/location`
   - `POST /api/dns/profile-sync`
   - `GET /api/sync/family-state`
   - `POST /api/revenuecat/webhook`

Critério para avançar:

- Endpoint `GET /api/sync/family-state?parentId=<id>` responde sem erro 5xx.
- Endpoint `POST /api/realtime/location` responde `{ ok: true }` com payload válido.

---

## Passo 3 — App (`.env`)

1. Copie o exemplo de ambiente:

   ```bash
   cp .env.example .env
   ```

2. Preencha `.env` com os valores do **Passo 1** e do **Passo 2** (e chaves OneSignal, RevenueCat, NextDNS conforme o guia), **sem mocks**.
   - Mínimo para piloto: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SYNC_API_BASE_URL` (URL da API no Vercel).
   - Recomendado: `ONESIGNAL_APP_ID`, `REVENUECAT_ANDROID_API_KEY`, `REVENUECAT_IOS_API_KEY`, `DNS_VALIDATION_BLOCKED_DOMAIN`, `NEXTDNS_PROFILE_ID`, `NEXTDNS_API_KEY` (se usar DNS real).
3. Revalide ambiente:

   ```bash
   npm run check:env
   ```

---

## Passo 4 — Rodar o piloto

1. Reset e início limpo:

   ```bash
   npm run start:reset
   ```

2. Inicie o app:

   ```bash
   npm run android
   ```

   ou

   ```bash
   npm run ios
   ```

3. Valide no dispositivo/emulador:
   - Login (Supabase Auth)
   - Pareamento (family pairing)
   - Localização (realtime)
   - Quick Actions
   - DNS (validação e perfil, se configurado)

Com isso você tem a **versão piloto** do app real contra backend real.

Critério para avançar:

- Login + pareamento + localização funcionando no mesmo ciclo de teste.
- Quick Actions executando no dispositivo da criança.
- Sem fallback de mock por ausência de `SYNC_API_BASE_URL`.

---

## Passo 5 (opcional) — Lojas

A publicação na Play Store e na App Store segue o [guia completo](GO_LIVE_PLAYSTORE_APPSTORE.md), após validar o piloto nos passos 1–4.

Antes de abrir rollout de loja, rode:

```bash
npm run check:env:strict
```
