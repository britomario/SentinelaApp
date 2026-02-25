# Fix: StorageManager.getVolumes() no emulador Android

## Problema

Erro ao instalar o APK no emulador:

```
java.lang.NullPointerException: Attempt to invoke virtual method 
'java.util.List android.os.storage.StorageManager.getVolumes()' on a null object reference
```

É um **bug do emulador Android 14** (API 34) quando o armazenamento está em estado inconsistente.

## Solução rápida

```bash
# 1. Rodar o script de fix (wipe + cold boot)
./scripts/fix-android-emulator.sh

# 2. Quando o emulador terminar de iniciar, em outro terminal:
npx react-native run-android
```

Com AVD diferente de Pixel_3:

```bash
./scripts/fix-android-emulator.sh Nome_do_Seu_AVD
```

## Solução alternativa: novo AVD com Android 13

Se o problema persistir, crie um emulador com API 33 (mais estável):

1. Android Studio → Device Manager → Create Virtual Device
2. Escolha um dispositivo (ex: Pixel 6)
3. **System Image**: selecione **API 33** (Android 13) em vez de API 34
4. Baixe a imagem se necessário
5. Crie o AVD e use-o:

```bash
npx react-native run-android --deviceId Nome_do_Novo_AVD
```

## Uso de dispositivo físico

Para evitar problemas do emulador:

1. Ative **Opções do desenvolvedor** no celular
2. Ative **Depuração USB**
3. Conecte por USB
4. `adb devices` para confirmar
5. `npx react-native run-android`
