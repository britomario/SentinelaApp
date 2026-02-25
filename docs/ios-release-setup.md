# iOS Release Setup (Staging -> Production)

## 1) Bundle IDs e ambientes

- Staging: `com.sentinela.app.staging`
- Production: `com.sentinela.app`
- Nunca reutilizar provisioning profile de staging em produção.

## 2) Capabilities obrigatórias

- Sign In with Apple
- Push Notifications
- Background Modes (`location`, `fetch`)
- Network Extensions (DNS Settings / DNS Proxy), conforme plano empresarial e aprovação Apple.

## 3) Entitlements

- Arquivo base: `ios/SentinelaApp/SentinelaApp.entitlements`
- Validar presença de:
  - `com.apple.developer.networking.networkextension = dns-settings/dns-proxy`

## 4) Credenciais em staging

- Configurar chaves de OAuth (Google/Apple) apontando para callback de staging.
- Validar RevenueCat e OneSignal em apps separados de staging.
- Usar DSN de staging para Sentry.

## 5) Promoção para produção

- Checklist técnico aprovado em staging.
- Rotação de segredos e emissão de novos valores de produção.
- Atualizar App Store Connect:
  - descrição de coleta de localização,
  - política de privacidade infantil,
  - categorias etárias e parental controls.
