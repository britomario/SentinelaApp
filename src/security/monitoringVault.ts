import AsyncStorage from '@react-native-async-storage/async-storage';
import {encryptMonitoringPayload, EncryptedEnvelope} from './e2eeService';
import {getChildPairingConfig} from '../services/pairingService';

const ENCRYPTED_EVENTS_KEY = 'sentinela.monitoring.encryptedEvents';

type MonitoringEvent = {
  type: 'domain_blocked';
  domain: string;
  timestamp: number;
};

export async function encryptAndStoreMonitoringEvent(
  event: MonitoringEvent,
): Promise<EncryptedEnvelope | null> {
  const pairing = await getChildPairingConfig();
  if (!pairing?.parentPublicKeyB64) {
    return null;
  }
  const envelope = await encryptMonitoringPayload(event, pairing.parentPublicKeyB64);
  await appendEncryptedEnvelope(envelope);
  return envelope;
}

async function appendEncryptedEnvelope(envelope: EncryptedEnvelope): Promise<void> {
  const current = await getEncryptedEvents();
  const next = [envelope, ...current].slice(0, 200);
  await AsyncStorage.setItem(ENCRYPTED_EVENTS_KEY, JSON.stringify(next));
}

export async function getEncryptedEvents(): Promise<EncryptedEnvelope[]> {
  const raw = await AsyncStorage.getItem(ENCRYPTED_EVENTS_KEY);
  if (!raw) {
    return [];
  }
  try {
    return JSON.parse(raw) as EncryptedEnvelope[];
  } catch {
    return [];
  }
}
