import SHA256 from 'crypto-js/sha256';
import {getRandomValues} from '../security/cryptoRuntime';
import {getSupabaseClient} from './supabaseClient';

const PIN_TABLE = 'login_security_pins';

function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin);
}

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

function hashPin(pin: string, salt: string): string {
  return SHA256(`${pin}:${salt}`).toString();
}

function createSalt(): string {
  const bytes = getRandomValues(new Uint8Array(16));
  return toHex(bytes);
}

export async function hasCloudLoginPin(userId: string): Promise<boolean> {
  const supabase = getSupabaseClient();
  if (!supabase || !userId) {
    return false;
  }
  const result = await supabase
    .from(PIN_TABLE)
    .select('user_id')
    .eq('user_id', userId)
    .maybeSingle();
  return !!result.data?.user_id;
}

export async function upsertCloudLoginPin(userId: string, pin: string): Promise<boolean> {
  if (!isValidPin(pin)) {
    return false;
  }
  const supabase = getSupabaseClient();
  if (!supabase || !userId) {
    return false;
  }
  const salt = createSalt();
  const pinHash = hashPin(pin, salt);
  const result = await supabase.from(PIN_TABLE).upsert(
    {
      user_id: userId,
      pin_hash: pinHash,
      pin_salt: salt,
      updated_at: new Date().toISOString(),
    },
    {onConflict: 'user_id'},
  );
  return !result.error;
}

export async function verifyCloudLoginPin(userId: string, pin: string): Promise<boolean> {
  if (!isValidPin(pin)) {
    return false;
  }
  const supabase = getSupabaseClient();
  if (!supabase || !userId) {
    return false;
  }
  const result = await supabase
    .from(PIN_TABLE)
    .select('pin_hash,pin_salt')
    .eq('user_id', userId)
    .maybeSingle();
  const row = result.data;
  if (!row?.pin_hash || !row?.pin_salt) {
    return false;
  }
  return hashPin(pin, row.pin_salt) === row.pin_hash;
}
