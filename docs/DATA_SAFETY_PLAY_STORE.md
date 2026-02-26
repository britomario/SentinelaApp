# Data Safety - Play Store (02/2026)

Checklist para preencher o formulário Data Safety na Play Console, com base nos dados que o Sentinela coleta.

## Dados coletados e compartilhados

| Categoria              | Dados               | Finalidade           | Obrigatório? | Compartilhado? |
|------------------------|--------------------|----------------------|--------------|----------------|
| Localização            | Localização aproximada e precisa | Monitoramento parental, segurança | Sim (core) | Não (apenas Supabase/backend próprio) |
| Identificadores       | ID do dispositivo, ID de assinatura | Vinculação pai-filho, autenticação | Sim | Não |
| Informações da conta  | Email (login Google/Apple) | Autenticação | Sim | Não |
| Dados de compras      | Estado de assinatura | Habilitar Premium | Não | RevenueCat (processador) |
| Dados do app          | Uso de apps (lista, tempo) | Controle parental | Sim | Não |
| Outros                 | Eventos de segurança (anti-tamper) | Integridade do app | Sim | Não |

## Declarações recomendadas

1. **Coleta de dados**: Sim, o app coleta dados.
2. **Compartilhamento**: Dados compartilhados com processadores (Supabase, RevenueCat, OneSignal) para operação do serviço. Nenhuma venda de dados.
3. **Segurança**: Dados transmitidos via HTTPS; armazenamento criptografado no backend.
4. **Política de privacidade**: URL obrigatória. Use a política publicada (ex: https://sentinela.app/privacy).
5. **Apps para crianças**: Se o app for direcionado a menores de 13 anos, declare conformidade COPPA e políticas de conteúdo infantil.

## Referências

- [Google Play Data Safety](https://support.google.com/googleplay/android-developer/answer/10787469)
- [Prepare for data disclosure](https://developers.google.com/android/guides/play-data-disclosure)
- [privacy-compliance-minors.md](privacy-compliance-minors.md)
