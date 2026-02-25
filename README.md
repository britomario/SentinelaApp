# Sentinela

Segurança digital para crianças com controle parental simples, acolhedor e eficiente.

## Funcionalidades

- **Dashboard** — Acompanhamento em tempo real, localização, gráficos de uso, Quick Actions (bloquear agora, adicionar tempo, ver tela ao vivo)
- **Modo Criança** — Interface gamificada (Safe Space), tokens, tarefas, desbloqueio de apps com recompensas
- **Controle de Apps** — Listagem nativa de apps instalados, bloqueio/permissão por app, sincronização com Supabase
- **Configurações** — DNS (nativo/DoH), política de apps, anti-tampering
- **Pareamento** — QR code zero-knowledge, deep links
- **Premium** — Licença anual, trial, RevenueCat
- **Notificações** — OneSignal, alertas ao responsável

## Tech Stack

- React Native 0.76
- TypeScript
- Supabase, RevenueCat, OneSignal, Sentry
- react-native-reanimated, react-native-maps, react-native-svg

## Pré-requisitos

- Node.js >= 18
- npm ou yarn
- Android Studio (Android) / Xcode (iOS)
- Java 17+ (Android)
- CocoaPods (iOS)

## Instalação

```bash
git clone <url-do-repositorio>
cd SentinelaApp
npm install
```

## Variáveis de ambiente

Copie `.env.example` para `.env` e preencha as variáveis:

```bash
cp .env.example .env
```

Variáveis principais: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `ONESIGNAL_APP_ID`, `REVENUECAT_ANDROID_API_KEY`, `REVENUECAT_IOS_API_KEY`, `SYNC_API_BASE_URL`.

Consulte [docs/DEVOPS_SECRETS.md](docs/DEVOPS_SECRETS.md) para detalhes.

## Build e execução

```bash
# Iniciar Metro
npm start

# Android (em outro terminal)
npm run android

# iOS
npm run ios

# Resetar cache
npm run start:reset
```

## Troubleshooting Android

Se o emulador falhar com `StorageManager.getVolumes() null`:

```bash
npm run android:emulator-fix   # wipe + cold boot
# Quando o emulador iniciar: npm run android
```

Detalhes: [docs/ANDROID_EMULATOR_FIX.md](docs/ANDROID_EMULATOR_FIX.md)

## Documentação

- [DevOps e Segredos](docs/DEVOPS_SECRETS.md)
- [Release Checklist](docs/release-checklist.md)
- [iOS Release Setup](docs/ios-release-setup.md)
- [Segurança e Operações](docs/security-operations.md)
- [Compliance Privacidade](docs/privacy-compliance-minors.md)
- [Full App Review](docs/full-app-review-protocol.md)
