#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const args = new Set(process.argv.slice(2));
const strictMode = args.has('--strict');

const requiredCore = [
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SYNC_API_BASE_URL',
];

const requiredInStrict = [
  'ONESIGNAL_APP_ID',
  'ONESIGNAL_REST_API_KEY',
  'REVENUECAT_ANDROID_API_KEY',
  'REVENUECAT_IOS_API_KEY',
  'REVENUECAT_WEBHOOK_SECRET',
  'NEXTDNS_PROFILE_ID',
  'NEXTDNS_API_KEY',
  'DNS_VALIDATION_BLOCKED_DOMAIN',
];

const recommended = [
  'SENTRY_DSN',
  'REALTIME_SOCKET_URL',
  'MAPS_PROVIDER',
  'MAPS_API_KEY',
  'DNS_POLICY_API_BASE_URL',
];

function parseEnvFile(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  const raw = fs.readFileSync(filePath, 'utf8');
  const result = {};
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }
    const idx = trimmed.indexOf('=');
    if (idx === -1) {
      continue;
    }
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    result[key] = value;
  }
  return result;
}

function loadEnv() {
  const envFile = path.join(projectRoot, '.env');
  const envLocalFile = path.join(projectRoot, '.env.local');
  const exampleFile = path.join(projectRoot, '.env.example');

  const example = parseEnvFile(exampleFile);
  const env = parseEnvFile(envFile);
  const envLocal = parseEnvFile(envLocalFile);

  return {
    env: {
      ...example,
      ...env,
      ...envLocal,
      ...process.env,
    },
    hasDotEnv: fs.existsSync(envFile),
    hasDotEnvLocal: fs.existsSync(envLocalFile),
  };
}

function isMissing(value) {
  return value === undefined || value === null || String(value).trim() === '';
}

function validatePair(values, keyA, keyB) {
  const hasA = !isMissing(values[keyA]);
  const hasB = !isMissing(values[keyB]);
  if (hasA && !hasB) {
    return [`${keyB} está faltando (exigido quando ${keyA} está definido).`];
  }
  if (!hasA && hasB) {
    return [`${keyA} está faltando (exigido quando ${keyB} está definido).`];
  }
  return [];
}

function main() {
  const {env, hasDotEnv, hasDotEnvLocal} = loadEnv();
  const missingRequired = [];
  const warnings = [];

  const requiredNow = strictMode
    ? [...requiredCore, ...requiredInStrict]
    : requiredCore;

  for (const key of requiredNow) {
    if (isMissing(env[key])) {
      missingRequired.push(key);
    }
  }

  for (const key of recommended) {
    if (isMissing(env[key])) {
      warnings.push(`${key} não definido (recomendado).`);
    }
  }

  warnings.push(
    ...validatePair(env, 'NEXTDNS_PROFILE_ID', 'NEXTDNS_API_KEY'),
    ...validatePair(env, 'ONESIGNAL_APP_ID', 'ONESIGNAL_REST_API_KEY'),
    ...validatePair(env, 'REVENUECAT_ANDROID_API_KEY', 'REVENUECAT_IOS_API_KEY'),
  );

  const modeLabel = strictMode ? 'STRICT (produção)' : 'CORE (piloto)';
  console.log(`\nSentinela env check - modo ${modeLabel}`);
  console.log(`.env presente: ${hasDotEnv ? 'sim' : 'nao'}`);
  console.log(`.env.local presente: ${hasDotEnvLocal ? 'sim' : 'nao'}`);

  if (missingRequired.length > 0) {
    console.error('\nVariáveis obrigatórias faltando:');
    for (const key of missingRequired) {
      console.error(`- ${key}`);
    }
  } else {
    console.log('\nObrigatórias: OK');
  }

  if (warnings.length > 0) {
    console.log('\nAvisos:');
    for (const warning of warnings) {
      console.log(`- ${warning}`);
    }
  }

  if (missingRequired.length > 0) {
    console.error('\nResultado: FAIL');
    process.exit(1);
  }

  console.log('\nResultado: PASS');
}

main();
