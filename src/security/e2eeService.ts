import AsyncStorage from '@react-native-async-storage/async-storage';

import {getRandomValues, getSubtleCrypto} from './cryptoRuntime';

const PARENT_PRIVATE_KEY_STORAGE = 'sentinela.e2ee.parent.privateKey.pkcs8';
const PARENT_PUBLIC_KEY_STORAGE = 'sentinela.e2ee.parent.publicKey.spki';

export type EncryptedEnvelope = {
  alg: 'AES-256-GCM+RSA-OAEP-256';
  encryptedKeyB64: string;
  ivB64: string;
  ciphertextB64: string;
  createdAt: number;
};

export type ParentKeyMaterial = {
  publicKeyB64: string;
  privateKeyB64: string;
};

export async function ensureParentKeyPair(): Promise<ParentKeyMaterial> {
  const [publicKeyB64, privateKeyB64] = await AsyncStorage.multiGet([
    PARENT_PUBLIC_KEY_STORAGE,
    PARENT_PRIVATE_KEY_STORAGE,
  ]).then(items => [items[0][1], items[1][1]]);

  if (publicKeyB64 && privateKeyB64) {
    return {publicKeyB64, privateKeyB64};
  }

  const subtle = getSubtleCrypto();
  const keys = await subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt'],
  );

  const spki = await subtle.exportKey('spki', keys.publicKey);
  const pkcs8 = await subtle.exportKey('pkcs8', keys.privateKey);
  const generatedPublic = arrayBufferToBase64(spki);
  const generatedPrivate = arrayBufferToBase64(pkcs8);

  await AsyncStorage.multiSet([
    [PARENT_PUBLIC_KEY_STORAGE, generatedPublic],
    [PARENT_PRIVATE_KEY_STORAGE, generatedPrivate],
  ]);

  return {publicKeyB64: generatedPublic, privateKeyB64: generatedPrivate};
}

export async function encryptMonitoringPayload(
  payload: unknown,
  parentPublicKeyB64: string,
): Promise<EncryptedEnvelope> {
  const subtle = getSubtleCrypto();
  const serialized = JSON.stringify(payload);
  const messageBytes = new TextEncoder().encode(serialized);

  const aesKey = await subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256,
    },
    true,
    ['encrypt', 'decrypt'],
  );
  const iv = getRandomValues(new Uint8Array(12));
  const ciphertext = await subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    aesKey,
    messageBytes,
  );
  const rawAesKey = await subtle.exportKey('raw', aesKey);
  const importedPublicKey = await subtle.importKey(
    'spki',
    base64ToArrayBuffer(parentPublicKeyB64),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['encrypt'],
  );

  const encryptedAesKey = await subtle.encrypt(
    {name: 'RSA-OAEP'},
    importedPublicKey,
    rawAesKey,
  );

  return {
    alg: 'AES-256-GCM+RSA-OAEP-256',
    encryptedKeyB64: arrayBufferToBase64(encryptedAesKey),
    ivB64: arrayBufferToBase64(iv.buffer),
    ciphertextB64: arrayBufferToBase64(ciphertext),
    createdAt: Date.now(),
  };
}

export async function decryptMonitoringPayload(
  envelope: EncryptedEnvelope,
  parentPrivateKeyB64: string,
): Promise<unknown> {
  const subtle = getSubtleCrypto();
  const privateKey = await subtle.importKey(
    'pkcs8',
    base64ToArrayBuffer(parentPrivateKeyB64),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    false,
    ['decrypt'],
  );
  const rawAesKey = await subtle.decrypt(
    {name: 'RSA-OAEP'},
    privateKey,
    base64ToArrayBuffer(envelope.encryptedKeyB64),
  );
  const aesKey = await subtle.importKey(
    'raw',
    rawAesKey,
    {name: 'AES-GCM'},
    false,
    ['decrypt'],
  );
  const plaintext = await subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: new Uint8Array(base64ToArrayBuffer(envelope.ivB64)),
    },
    aesKey,
    base64ToArrayBuffer(envelope.ciphertextB64),
  );
  return JSON.parse(new TextDecoder().decode(plaintext));
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach(byte => {
    binary += String.fromCodePoint(byte);
  });
  return btoa(binary);
}

function base64ToArrayBuffer(value: string): ArrayBuffer {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.codePointAt(i) ?? 0;
  }
  return bytes.buffer;
}
