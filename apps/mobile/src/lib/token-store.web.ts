import type { StoredTokens, TokenStore } from './api-client';

const KEY = 'lokacia.tokens.v1';

/** Web preview only (expo-secure-store has no web implementation): sessionStorage, cleared with the tab. */
export const secureTokenStore: TokenStore = {
  async load() {
    try {
      const raw = globalThis.sessionStorage?.getItem(KEY);
      return raw ? (JSON.parse(raw) as StoredTokens) : null;
    } catch {
      return null;
    }
  },
  async save(tokens) {
    try {
      if (tokens) globalThis.sessionStorage?.setItem(KEY, JSON.stringify(tokens));
      else globalThis.sessionStorage?.removeItem(KEY);
    } catch {
      /* storage unavailable (private mode) — session stays in memory */
    }
  },
};
