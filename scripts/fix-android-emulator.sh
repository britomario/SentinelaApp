#!/bin/bash
# Corrige o bug StorageManager.getVolumes() null no emulador Android 14.
# Execute antes de: npx react-native run-android

set -e

# Detecta caminho do emulador
SDK_ROOT="${ANDROID_HOME:-$ANDROID_SDK_ROOT}"
if [[ -z "$SDK_ROOT" ]]; then
  SDK_ROOT="$HOME/Library/Android/sdk"
fi
EMULATOR_PATH="$SDK_ROOT/emulator/emulator"
if [[ ! -x "$EMULATOR_PATH" ]]; then
  echo "Erro: emulador não encontrado em $EMULATOR_PATH"
  echo "Configure ANDROID_HOME ou instale o Android SDK."
  exit 1
fi

AVD_NAME="${1:-Pixel_3}"

echo "🔧 Fix emulador Android - StorageManager NPE"
echo "   AVD: $AVD_NAME"
echo ""

# Mata emuladores em execução
echo "1. Encerrando emuladores..."
adb emu kill 2>/dev/null || true
sleep 2

# Wipe data + cold boot (corrige StorageManager.getVolumes null)
echo "2. Iniciando emulador com -wipe-data e -no-snapshot-load (cold boot)..."
echo "   Aguarde o boot completo antes de rodar run-android!"
echo ""

"$EMULATOR_PATH" -avd "$AVD_NAME" -wipe-data -no-snapshot-load -no-audio &

echo "3. Aguardando boot (boot_completed)..."
adb wait-for-device
for i in {1..60}; do
  [[ "$(adb shell getprop sys.boot_completed 2>/dev/null)" == "1" ]] && break
  sleep 2
done
echo ""
echo "✅ Emulador pronto. Execute: npx react-native run-android"
