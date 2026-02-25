import React from 'react';
import RootNavigator from './src/navigation/RootNavigator';
import {ToastProvider} from './src/components/feedback/ToastProvider';
import {ReviewPromptProvider} from './src/components/feedback/ReviewPromptProvider';
import PairingDeepLinkHandler from './src/components/pairing/PairingDeepLinkHandler';
import {initializeSentry} from './src/services/observability/sentry';
import {initializeOneSignal} from './src/services/notifications/oneSignalService';
import {initializeRevenueCat} from './src/services/revenuecatService';

initializeSentry();

export default function App(): React.ReactElement {
  React.useEffect(() => {
    initializeOneSignal().catch(() => undefined);
    initializeRevenueCat().catch(() => undefined);
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
