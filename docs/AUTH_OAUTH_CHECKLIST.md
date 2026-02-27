# Checklist de OAuth / Login Social (Android)

Este checklist garante que os logins sociais (Google, Apple, Facebook) funcionem corretamente no app Sentinela para Android.

## Configuração no Supabase

1. **Redirect URL**
   - No painel Supabase: Auth > URL Configuration > Redirect URLs
   - Adicione: `sentinela://auth/callback`
   - Essa URL deve estar na lista de URLs permitidas para que o OAuth retorne ao app.

2. **Providers habilitados**
   - No painel Supabase: Auth > Providers
   - Habilite os provedores desejados:
     - Google (configure client ID e secret do Google Cloud Console)
     - Apple (configure credentials do Apple Developer)
     - Facebook (configure app ID e secret do Facebook Developers)

3. **Variáveis de ambiente**
   - `SUPABASE_URL` e `SUPABASE_ANON_KEY` devem estar corretos no `.env` do app.
   - **IMPORTANTE:** `SUPABASE_URL` deve ser a **base URL do projeto** (ex.: `https://YOUR_PROJECT_REF.supabase.co`). Nunca use o endpoint de callback (`/auth/v1/callback`) como URL.

## Validação em dispositivo Android

1. **Teste por provedor**
   - Toque em "Vincular com Google" e confirme que o navegador ou provedor abre.
   - Complete o fluxo OAuth e confirme que o app recebe o callback e autentica.
   - Repita para Apple e Facebook conforme habilitados.

2. **Fluxo esperado**
   - O app abre a tela de login do provedor (navegador ou intent nativo).
   - Após autenticar, o provedor redireciona para `sentinela://auth/callback`.
   - O app processa o callback e conclui a sessão.

## Em caso de falha

- **"Configuração Supabase inválida"**: `SUPABASE_URL` deve ser a base URL do projeto (`https://XXX.supabase.co`), não o endpoint de callback. Corrija o `.env` e reinicie o app.
- **"Não foi possível abrir a tela de autenticação"**: Verifique se há navegador instalado e se a query para `https` está no AndroidManifest (ver `android/app/src/main/AndroidManifest.xml`).
- **"Retorno de autenticação inválido"**: Confirme que `sentinela://auth/callback` está nas Redirect URLs do Supabase.
- **"Não foi possível iniciar o login"**: Verifique se o provedor está habilitado e configurado no painel Supabase.
