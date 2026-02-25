/**
 * Quick Actions Dispatch - envia comandos reais ao dispositivo monitorado.
 * Contrato: block_now | grant_time | live_screen_request com ack/erro e telemetria.
 */

import {getEnv} from './config/env';
import {captureHandledError} from './observability/sentry';

export type QuickActionType =
  | 'block_now'
  | 'grant_time'
  | 'live_screen_request';

export type DispatchResult =
  | {ok: true; localOnly?: boolean}
  | {ok: false; reason: string};

const ACTION_LABELS: Record<QuickActionType, string> = {
  block_now: 'Bloquear agora',
  grant_time: 'Adicionar 30min',
  live_screen_request: 'Ver tela ao vivo',
};

export async function dispatchQuickAction(
  action: QuickActionType,
  childId: string,
): Promise<DispatchResult> {
  const apiBase = getEnv('SYNC_API_BASE_URL');
  if (!apiBase) {
    return {ok: true, localOnly: true};
  }

  try {
    const response = await fetch(`${apiBase}/api/alerts/dispatch`, {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        childId,
        action,
        title: `Sentinela: ${ACTION_LABELS[action]}`,
        message: getActionMessage(action),
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      captureHandledError(
        new Error(`Quick action failed: ${response.status}`),
        `quick_action_${action}`,
      );
      return {
        ok: false,
        reason: data.reason ?? `http_${response.status}`,
      };
    }

    if (data.ok === false) {
      return {ok: false, reason: data.reason ?? 'dispatch_failed'};
    }

    return {ok: true};
  } catch (error) {
    captureHandledError(error, `quick_action_${action}`);
    return {ok: false, reason: 'network_error'};
  }
}

function getActionMessage(action: QuickActionType): string {
  switch (action) {
    case 'block_now':
      return 'Comando de bloqueio enviado ao dispositivo.';
    case 'grant_time':
      return '30 minutos adicionados ao tempo de tela.';
    case 'live_screen_request':
      return 'Solicitando visualizacao da tela ao vivo.';
    default:
      return 'Acao enviada.';
  }
}
