import http from 'node:http';
import https from 'node:https';
import { syncBuiltinESMExports } from 'node:module';

export const OFFLINE_NETWORK_GUARD_SYMBOL = 'tradingview-mcp.test-unit.offline-network-guard';
export const BLOCKED_EXTERNAL_NETWORK_CODE = 'UNIT_EXTERNAL_NETWORK_BLOCKED';

const installedKey = Symbol.for(OFFLINE_NETWORK_GUARD_SYMBOL);

function normalizedHost(value) {
  let host = String(value ?? '').trim().toLowerCase().replace(/\.$/, '');
  if (host.startsWith('[')) {
    const closingBracket = host.indexOf(']');
    if (closingBracket !== -1) host = host.slice(1, closingBracket);
  } else if (host !== '::1' && host.includes(':')) {
    host = host.split(':', 1)[0];
  }
  return host;
}

export function isLoopbackHost(value) {
  const host = normalizedHost(value);
  return host === 'localhost' || host === '::1' || /^127(?:\.\d{1,3}){3}$/.test(host);
}

function requestHost(input, options, defaultProtocol) {
  if (input instanceof URL) return input.hostname;
  if (typeof input === 'string') {
    try {
      return new URL(input).hostname;
    } catch {
      return new URL(input, `${defaultProtocol}//localhost`).hostname;
    }
  }
  if (input && typeof input.url === 'string') return new URL(input.url).hostname;

  const config = input && typeof input === 'object' ? input : options;
  return config?.hostname ?? config?.host ?? 'localhost';
}

function blockedRequestError(host) {
  const error = new Error(`test:unit blocked external network access to ${normalizedHost(host) || '<unknown>'}`);
  error.code = BLOCKED_EXTERNAL_NETWORK_CODE;
  return error;
}

export function assertLoopbackRequest(input, options, defaultProtocol = 'http:') {
  const host = requestHost(input, options, defaultProtocol);
  if (!isLoopbackHost(host)) throw blockedRequestError(host);
}

function guardRequest(original, defaultProtocol) {
  return function guardedRequest(input, options, ...rest) {
    assertLoopbackRequest(input, options, defaultProtocol);
    return Reflect.apply(original, this, [input, options, ...rest]);
  };
}

function propagateGuardToNodeChildren() {
  const guardOption = `--import=${import.meta.url}`;
  const current = process.env.NODE_OPTIONS?.trim() || '';
  if (!current.includes(import.meta.url)) {
    process.env.NODE_OPTIONS = `${current} ${guardOption}`.trim();
  }
}

if (!globalThis[installedKey]) {
  globalThis[installedKey] = true;

  if (typeof globalThis.fetch === 'function') {
    const originalFetch = globalThis.fetch.bind(globalThis);
    globalThis.fetch = function guardedFetch(input, options) {
      try {
        assertLoopbackRequest(input, options, 'http:');
      } catch (error) {
        return Promise.reject(error);
      }
      return originalFetch(input, options);
    };
  }

  http.request = guardRequest(http.request, 'http:');
  http.get = guardRequest(http.get, 'http:');
  https.request = guardRequest(https.request, 'https:');
  https.get = guardRequest(https.get, 'https:');
  syncBuiltinESMExports();
}

propagateGuardToNodeChildren();

export function isOfflineNetworkGuardInstalled() {
  return globalThis[installedKey] === true;
}
