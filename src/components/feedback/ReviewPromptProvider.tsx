import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {AppState} from 'react-native';

import {useToast} from './ToastProvider';
import ReviewPromptModal from './ReviewPromptModal';
import {
  deferReviewForDays,
  getReviewEligibility,
  markPromptShown,
  markRated,
  recordSuccessSignal,
  requestNativeReviewIfAvailable,
  ReviewSignal,
  setNeverAskAgain,
  trackActiveDay,
} from '../../services/reviewService';

type ReviewPromptContextType = {
  recordReviewSignal: (signal: ReviewSignal) => Promise<void>;
};

const ReviewPromptContext = createContext<ReviewPromptContextType | null>(null);

export function ReviewPromptProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const {showToast} = useToast();
  const [visible, setVisible] = useState(false);

  const evaluateEligibility = useCallback(async () => {
    const eligibility = await getReviewEligibility();
    if (!eligibility.eligible) {
      return;
    }
    await markPromptShown();
    setVisible(true);
  }, []);

  useEffect(() => {
    trackActiveDay()
      .then(evaluateEligibility)
      .catch(() => undefined);

    const sub = AppState.addEventListener('change', nextState => {
      if (nextState !== 'active') {
        return;
      }
      trackActiveDay()
        .then(evaluateEligibility)
        .catch(() => undefined);
    });
    return () => sub.remove();
  }, [evaluateEligibility]);

  const recordReviewSignal = useCallback(
    async (signal: ReviewSignal) => {
      await recordSuccessSignal(signal);
      await evaluateEligibility();
    },
    [evaluateEligibility],
  );

  const handleRateNow = async () => {
    setVisible(false);
    const didOpen = await requestNativeReviewIfAvailable();
    if (didOpen) {
      showToast({
        kind: 'success',
        title: 'Obrigado por avaliar o Sentinela!',
      });
      await markRated();
      return;
    }
    showToast({
      kind: 'info',
      title: 'Avaliacao indisponivel agora',
      message: 'Tentaremos novamente em outro momento.',
    });
    await deferReviewForDays(7);
  };

  const handleLater = async () => {
    setVisible(false);
    await deferReviewForDays(7);
    showToast({
      kind: 'info',
      title: 'Combinado',
      message: 'Vamos lembrar novamente em 7 dias.',
    });
  };

  const handleNeverAsk = async () => {
    setVisible(false);
    await setNeverAskAgain();
    showToast({
      kind: 'info',
      title: 'Entendido',
      message: 'Nao vamos mais solicitar avaliacao.',
    });
  };

  const contextValue = useMemo(
    () => ({
      recordReviewSignal,
    }),
    [recordReviewSignal],
  );

  return (
    <ReviewPromptContext.Provider value={contextValue}>
      {children}
      <ReviewPromptModal
        visible={visible}
        onRateNow={handleRateNow}
        onLater={handleLater}
        onNeverAskAgain={handleNeverAsk}
      />
    </ReviewPromptContext.Provider>
  );
}

export function useReviewPrompt(): ReviewPromptContextType {
  const ctx = useContext(ReviewPromptContext);
  if (!ctx) {
    throw new Error('useReviewPrompt must be used inside ReviewPromptProvider');
  }
  return ctx;
}
