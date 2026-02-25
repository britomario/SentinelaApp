# Release Checklist - Sentinela

## Android

- [ ] Configurar assinatura de release (`keystore`, `keyAlias`, `keyPassword`) fora do repositório.
- [ ] Gerar `bundleRelease` e validar instalação em dispositivo físico.
- [ ] Revisar permissões do `AndroidManifest.xml` e manter apenas as necessárias.
- [ ] Confirmar `usesCleartextTraffic=false` e política de rede segura.
- [ ] Validar fluxo: Welcome -> PIN -> Tabs sem crash.
- [ ] Testar DNS nativo/DoH (modo leve e modo avancado) em Chrome/Firefox.
- [ ] Validar stream de localizacao em tempo real e alerta de inatividade (>10 min).
- [ ] Validar modo crianca restrito com PIN mestre.
- [ ] Capturar screenshots para Play Store e revisar classificação etária.

## iOS

- [ ] Revisar `Info.plist` com textos de privacidade e uso de localização.
- [ ] Validar capacidades/entitlements de rede antes do build final.
- [ ] Validar `SentinelaApp.entitlements` com DNSSettings/NetworkExtension no target correto.
- [ ] Rodar build release em dispositivo físico.
- [ ] Preparar screenshots, descrição e política de privacidade para App Store.

## Produto e Compliance

- [ ] Política de privacidade atualizada para monitoramento parental e consentimento.
- [ ] Documento LGPD/GDPR/COPPA revisado com jurídico.
- [ ] Termos explicam processamento local de sinais emocionais (sem conteúdo bruto).
- [ ] Eventos de telemetria excluem dados sensíveis e identificadores indevidos.
- [ ] Alertas e comunicação ao responsável claros sobre limites e bloqueios.
- [ ] Variáveis de ambiente de Supabase/RevenueCat/OneSignal/Sentry revisadas por ambiente.
- [ ] RLS validado com usuários reais de teste (pai não acessa família de terceiros).
- [ ] Webhook RevenueCat validado com assinatura secreta em ambiente de staging.
- [ ] Endpoint de push alerta funcional e sem payload sensível.
- [ ] Credenciais staging/prod separadas e validadas (OAuth, Maps, RevenueCat, OneSignal, Sentry).

## Qualidade Final

- [ ] Smoke test completo nas abas principais.
- [ ] Validar toasts, tours e skeletons em estados de carregamento.
- [ ] Validar trial premium e valor anual por dia.
- [ ] Conferir regressão de performance em telas com listas e dashboard.
- [ ] Verificar captura de erro em Sentry com evento de teste controlado.
- [ ] Rodar full app review com pareamento do zero em redes diferentes.
