import * as SecureStore from 'expo-secure-store';
import type { StoredTokens, TokenStore } from './api-client';

const KEY = 'lokacia.tokens.v1';

/** iOS Keychain / Android Keystore via expo-secure-store (native). Web build uses token-store.web.ts. */
export const secureTokenStore: TokenStore = {
  async load() {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      return raw ? (JSON.parse(raw) as StoredTokens) : null;
    } catch {
      return null;
    }
  },
  async save(tokens) {
    if (tokens) await SecureStore.setItemAsync(KEY, JSON.stringify(tokens), { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK });
    else await SecureStore.deleteItemAsync(KEY);
  },
};
