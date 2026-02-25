# Security Operations - Sentinela

## Secret Management

- Never commit private keys, webhook secrets, or production DSN/API keys.
- Keep production values in secure platform variables (Vercel/Supabase/CI).
- Allowed in client runtime: public Supabase URL and anon key only.

## Environment Variables

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SENTRY_DSN`
- `REVENUECAT_ANDROID_API_KEY`
- `REVENUECAT_IOS_API_KEY`
- `ONESIGNAL_APP_ID`
- `ONESIGNAL_REST_API_KEY` (server only)
- `REVENUECAT_WEBHOOK_SECRET` (server only)
- `SYNC_API_BASE_URL`
- `REALTIME_SOCKET_URL`
- `MAPS_PROVIDER`
- `MAPS_API_KEY`
- `DNS_POLICY_API_BASE_URL`
- `DNS_PROVIDER_DEFAULT`
- `FEATURE_REALTIME_LOCATION`
- `FEATURE_DOH_ENGINE`
- `FEATURE_CHILD_ANTITAMPER`

## Incident Readiness

- Monitor crashes and JS/native exceptions in Sentry.
- Alert on webhook failures (`/api/revenuecat/webhook`) and push dispatch failures (`/api/alerts/dispatch`).
- Keep a rollback APK/AAB for last known good release.
- Track location stream freshness (`last location > 10 min`) and alert responsible parent.

## Privacy Baseline

- Do not store raw child content in backend logs.
- Persist only minimal aggregated signals for emotional alerts.
- Pairing tokens must be short-lived and rotated.

## Access Control

- Enforce RLS for parent/child records in Supabase.
- Validate service-to-service calls with server-side secrets.
- Audit sensitive events: login, pairing, subscription status changes.
- Gate anti-tamper disable actions behind master PIN validation.

## Staging to Production Promotion

- Promote only after passing release checklist and E2E protocol in staging.
- Rotate OAuth, webhook and push secrets during production cutover.
- Keep separate Sentry projects or environments per stage.
