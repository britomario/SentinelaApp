# Guia Go-Live (Banco + API + Lojas)

Este guia coloca o Sentinela em produção real, sem mocks.

## 1) Banco de dados (Supabase)

1. Crie projetos separados: `sentinela-staging` e `sentinela-prod`.
2. Ative Auth (Google + Apple), Realtime e RLS.
3. Execute o SQL base abaixo no projeto de produção:

```sql
create table if not exists child_location_state (
  child_id text primary key,
  latitude double precision not null,
  longitude double precision not null,
  accuracy double precision,
  timestamp bigint not null,
  updated_at timestamptz not null default now()
);

create table if not exists child_dns_policy (
  child_id text primary key,
  provider text,
  profile_id text,
  dot_host text,
  doh_url text,
  policy_tags text[] default '{}',
  updated_at timestamptz not null default now()
);

create table if not exists family_children (
  parent_id text not null,
  child_id text not null,
  alias text,
  status text default 'active',
  updated_at timestamptz not null default now(),
  primary key (parent_id, child_id)
);

create table if not exists family_premium_state (
  parent_id text primary key,
  active boolean not null default false,
  source text not null default 'revenuecat',
  entitlement_id text,
  updated_at timestamptz not null default now()
);

create table if not exists family_pairing_state (
  parent_id text primary key,
  latest_token_status text default 'unknown',
  updated_at timestamptz not null default now()
);
```

4. RLS: permitir leitura/escrita apenas para membros da própria família.
5. Gere e salve:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY` (somente backend)

## 2) API hospedada (Vercel)

1. Faça deploy da pasta com os endpoints `api/*`.
2. Configure variáveis no projeto Vercel:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ONESIGNAL_APP_ID`
   - `ONESIGNAL_REST_API_KEY`
   - `REVENUECAT_WEBHOOK_SECRET`
   - `NEXTDNS_PROFILE_ID`
   - `NEXTDNS_API_KEY`
3. Publique e valide:
   - `POST /api/alerts/dispatch`
   - `POST/GET /api/realtime/location`
   - `POST /api/dns/profile-sync`
   - `GET /api/sync/family-state`
   - `POST /api/revenuecat/webhook`

## 3) DNS real com NextDNS

1. Crie perfil familiar no NextDNS.
2. Ative categorias: adulto, gambling, malware e bypass/VPN.
3. Defina no backend:
   - `NEXTDNS_PROFILE_ID`
   - `NEXTDNS_API_KEY`
4. No app, aplique perfil DNS e confirme status de validação.

## 4) App mobile sem mocks

1. Preencha `.env` do app:
   - `SYNC_API_BASE_URL=https://sua-api.vercel.app`
   - `SUPABASE_URL=...`
   - `SUPABASE_ANON_KEY=...`
   - `ONESIGNAL_APP_ID=...`
   - `REVENUECAT_ANDROID_API_KEY=...`
   - `REVENUECAT_IOS_API_KEY=...`
   - `DNS_VALIDATION_BLOCKED_DOMAIN=pornhub.com`
2. Rebuild limpo:
   - `npm run start:reset`
   - `npm run android` / `npm run ios`

## 5) Play Store (Android)

1. Configure assinatura de release (keystore fora do repositório).
2. Gere AAB:
   - `cd android && ./gradlew bundleRelease`
3. Play Console:
   - Crie app + ficha da loja
   - Política de privacidade infantil
   - Data Safety completo
   - Classificação etária
   - Upload do AAB + rollout em produção (inicie em percentual)

## 6) App Store (iOS)

1. Bundle id produção: `com.sentinela.app`.
2. Capacidades:
   - Sign in with Apple
   - Push Notifications
   - Background Modes (`location`, `fetch`)
   - Network Extensions (se aplicável ao plano Apple)
3. Archive no Xcode e envio pelo Organizer.
4. App Store Connect:
   - Privacy Nutrition Labels
   - Parental controls e conteúdo infantil
   - Screenshots e revisão

## 7) Checklist final pré-publicação

1. Pareamento do zero funcionando.
2. Quick Actions funcionando remotamente.
3. SOS enviando alerta real.
4. DNS bloqueando categorias de risco com validação.
5. RevenueCat webhook atualizando estado premium.
6. Sentry recebendo evento de teste.
