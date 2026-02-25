import * as Sentry from '@sentry/react-native';
import {getEnv} from '../config/env';

let initialized = false;

export function initializeSentry(): void {
  if (initialized) {
    return;
  }
  const dsn = getEnv('SENTRY_DSN');
  if (!dsn) {
    return;
  }

  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    tracesSampleRate: 0.2,
  });
  initialized = true;
}

export function captureHandledError(error: unknown, context?: string): void {
  if (!initialized) {
    return;
  }
  Sentry.captureException(error, {
    tags: context ? {context} : undefined,
  });
}
