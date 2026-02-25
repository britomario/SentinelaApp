/**
 * Modo Descanso - Bem-estar digital.
 * Reduz brilho, filtro luz azul (nativo + overlay), copywriting motivacional.
 */

import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  NativeModules,
} from 'react-native';
import {useNavigation, CommonActions} from '@react-navigation/native';

import {
  applyRestModeDisplay,
  isRestModeActive,
  requestDisplayPermission,
  setRestModeActive,
} from '../services/restModeService';
import {Colors, Spacing, BorderRadius, Shadows} from '../theme/colors';
import PinGate from '../components/security/PinGate';
import {useToast} from '../components/feedback/ToastProvider';

const {SecurityModule} = NativeModules as {SecurityModule?: {hasSecurityPin?: () => Promise<boolean>}};

const REST_COPY = 'Hora de descansar os olhinhos! Para você acordar com toda a energia de um super-herói, vamos diminuir as luzes agora. Boa noite!';

export default function RestModeScreen(): React.JSX.Element {
  const navigation = useNavigation();
  const {showToast} = useToast();
  const [ready, setReady] = useState(false);
  const [showPinGate, setShowPinGate] = useState(false);
  const [hasPin, setHasPin] = useState<boolean | null>(null);
  const [restModeEnabled, setRestModeEnabled] = useState(false);

  useEffect(() => {
    SecurityModule?.hasSecurityPin?.()
      ?.then?.((v: boolean) => setHasPin(!!v))
      ?.catch?.(() => setHasPin(false));
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const currentlyActive = await isRestModeActive();
      if (mounted) {
        setRestModeEnabled(currentlyActive);
      }
      if (Platform.OS === 'android' && NativeModules.DisplayWellnessModule) {
        const hasPermission = await requestDisplayPermission();
        if (mounted) {
          setReady(hasPermission);
        }
        await applyRestModeDisplay(currentlyActive);
      } else {
        if (mounted) {
          setReady(true);
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const exitRestMode = async () => {
    await applyRestModeDisplay(false);
    await setRestModeActive(false);
    setRestModeEnabled(false);
    showToast({kind: 'success', title: 'Modo Descanso desativado'});
    navigation.dispatch(
      CommonActions.navigate({name: 'Dashboard'}),
    );
  };

  const enableRestMode = async () => {
    await setRestModeActive(true);
    await applyRestModeDisplay(true);
    setRestModeEnabled(true);
    showToast({kind: 'success', title: 'Modo Descanso ativado'});
  };

  const handleTogglePress = () => {
    if (!restModeEnabled) {
      enableRestMode().catch(() => {
        showToast({kind: 'error', title: 'Falha ao ativar Modo Descanso'});
      });
      return;
    }

    if (hasPin === false) {
      exitRestMode().catch(() => {
        showToast({kind: 'error', title: 'Falha ao desativar Modo Descanso'});
      });
      return;
    }
    setShowPinGate(true);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />
      <View style={[StyleSheet.absoluteFill, styles.blueLightOverlay]} pointerEvents="box-none" />
      <View style={styles.content}>
        <Text style={styles.emoji}>🌙✨</Text>
        <Text style={styles.title}>Modo Descanso</Text>
        <Text style={styles.copy}>{REST_COPY}</Text>
        {Platform.OS === 'android' && !ready && (
          <Text style={styles.hint}>
            Conceda permissão de configurações para reduzir o brilho automaticamente.
          </Text>
        )}
        <TouchableOpacity
          style={[styles.exitBtn, restModeEnabled ? styles.exitBtnOff : styles.exitBtnOn]}
          onPress={handleTogglePress}>
          <Text style={styles.exitBtnText}>
            {restModeEnabled ? 'Desativar Modo Descanso' : 'Ativar Modo Descanso'}
          </Text>
        </TouchableOpacity>
      </View>
      <PinGate
        visible={showPinGate}
        onClose={() => setShowPinGate(false)}
        onSuccess={exitRestMode}
        title="Digite o PIN para encerrar o Modo Descanso"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  blueLightOverlay: {
    backgroundColor: 'rgba(255, 180, 80, 0.12)',
  },
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: 360,
  },
  emoji: { fontSize: 64, marginBottom: Spacing.lg },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: Colors.white,
    marginBottom: Spacing.lg,
    textAlign: 'center',
  },
  copy: {
    fontSize: 18,
    lineHeight: 26,
    color: '#CBD5E1',
    textAlign: 'center',
    marginBottom: Spacing.xxl,
  },
  hint: {
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.lg,
  },
  exitBtn: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.xl,
    borderRadius: BorderRadius.xxl,
    ...Shadows.soft,
  },
  exitBtnOn: {
    backgroundColor: Colors.primary,
  },
  exitBtnOff: {
    backgroundColor: '#B91C1C',
  },
  exitBtnText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: 16,
  },
});
