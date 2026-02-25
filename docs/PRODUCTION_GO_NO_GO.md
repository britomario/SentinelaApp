# Gate de Produção (GO/NO-GO)

Este checklist consolida os critérios dos guias [`GO_LIVE_PILOT_STEPS.md`](GO_LIVE_PILOT_STEPS.md) e [`GO_LIVE_PLAYSTORE_APPSTORE.md`](GO_LIVE_PLAYSTORE_APPSTORE.md).

## Gate A - Piloto real (obrigatório antes de loja)

Rodar em sequência:

```bash
npm run check:env
npm run check:env:strict
npm run lint
```

Critérios de GO (todos obrigatórios):

- [ ] Migration `007_go_live_tables.sql` aplicada no Supabase sem erro.
- [ ] Endpoints `api/*` publicados na Vercel sem erro 5xx nos fluxos de teste.
- [ ] Login, pareamento e localização realtime funcionando no mesmo ciclo de teste.
- [ ] Quick Actions funcionando ponta a ponta com `SYNC_API_BASE_URL` configurado.
- [ ] DNS em estado **validado** com bloqueio real de domínio/categoria sensível.
- [ ] SOS enviando alerta real ao responsável.
- [ ] RevenueCat webhook atualizando `family_premium_state`.

Critérios de NO-GO (qualquer item bloqueia avanço):

- [ ] Fluxo crítico depende de mock/fallback local silencioso.
- [ ] Endpoint crítico falha em 5xx (`alerts/dispatch`, `realtime/location`, `dns/profile-sync`, `sync/family-state`, `revenuecat/webhook`).
- [ ] Estado DNS aparece como protegido sem bloqueio efetivo.
- [ ] Quebra funcional em onboarding, pareamento, dashboard, modo criança ou premium.

## Gate B - Publicação em loja

Critérios de GO (todos obrigatórios):

- [ ] Build Android release (`cd android && ./gradlew bundleRelease`) sem erro.
- [ ] Build iOS release (archive) em dispositivo físico sem crash no fluxo inicial.
- [ ] Compliance revisado (privacidade infantil, Data Safety, políticas da loja).
- [ ] Observabilidade ativa (Sentry + monitoramento de erro/latência dos endpoints).

Critérios de NO-GO (qualquer item bloqueia publicação):

- [ ] Credenciais de produção ausentes ou inconsistentes entre app/API.
- [ ] Crash crítico em fluxo principal.
- [ ] Reprovação de compliance pendente sem correção.

## Ordem de rollout recomendada

1. Android em rollout gradual: 5% -> 25% -> 100%.
2. Monitorar crash-free rate, latência dos endpoints e bloqueio DNS por 48h.
3. Publicar iOS após estabilidade confirmada do Android.
