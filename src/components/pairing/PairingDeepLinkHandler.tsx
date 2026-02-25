/**
 * Handles pairing deep links (sentinela://pair?...) when app is already open or opened via link.
 * Works alongside WelcomeScreen's listener for first-time onboarding.
 */

import React, {useEffect} from 'react';
import {Linking} from 'react-native';

import {useToast} from '../feedback/ToastProvider';
import {
  parsePairingUrl,
  storeChildPairingConfig,
} from '../../services/pairingService';

export default function PairingDeepLinkHandler({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const {showToast} = useToast();

  useEffect(() => {
    const consumePairingUrl = async (url: string | null) => {
      if (!url) {
        return;
      }
      const payload = parsePairingUrl(url);
      if (!payload) {
        return;
      }
      await storeChildPairingConfig({
        pairToken: payload.pairToken,
        parentPublicKeyB64: payload.parentPublicKeyB64,
        expiresAt: payload.expiresAt,
      });
      showToast({
        kind: 'success',
        title: 'Pareamento concluído',
        message: 'Dispositivo vinculado ao responsável.',
      });
    };

    Linking.getInitialURL()
      .then(consumePairingUrl)
      .catch(() => undefined);
    const sub = Linking.addEventListener('url', event => {
      consumePairingUrl(event.url).catch(() => undefined);
    });
    return () => sub.remove();
  }, [showToast]);

  return <>{children}</>;
}
