import React from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import {ToastProvider} from './src/components/feedback/ToastProvider';
import {ReviewPromptProvider} from './src/components/feedback/ReviewPromptProvider';
import PairingDeepLinkHandler from './src/components/pairing/PairingDeepLinkHandler';
import {initializeSentry} from './src/services/observability/sentry';
import {
  initializeOneSignal,
  setChildIdTag,
} from './src/services/notifications/oneSignalService';
import {initializeRevenueCat} from './src/services/revenuecatService';
import {deriveChildIdFromPairToken, getChildPairingConfig} from './src/services/pairingService';
import {getAuthenticatedUserId} from './src/services/authService';

initializeSentry();

export default function App(): React.ReactElement {
  React.useEffect(() => {
    initializeOneSignal().catch(() => undefined);
    initializeRevenueCat().catch(() => undefined);
  }, []);

  React.useEffect(() => {
    const ensureChildTag = async () => {
      const userId = await getAuthenticatedUserId().catch(() => null);
      if (userId) {
        return;
      }
      const pairing = await getChildPairingConfig().catch(() => null);
      if (pairing?.pairToken) {
        const childId = deriveChildIdFromPairToken(pairing.pairToken);
        await setChildIdTag(childId);
      }
    };
    ensureChildTag().catch(() => undefined);
  }, []);

  return React.createElement(
    ToastProvider,
    null,
    React.createElement(
      PairingDeepLinkHandler,
      null,
      React.createElement(ReviewPromptProvider, null, React.createElement(RootNavigator)),
    ),
  );
}
