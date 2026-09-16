import { mkdirSync } from 'node:fs';
import { expect, test as setup } from '@playwright/test';
import { saveRoleState } from '../lib/auth';
import { API_URL, AUTH_DIR } from '../lib/env';
import { ROLES, storageStateFor, type Role } from '../lib/roles';

setup('API is healthy', async ({ request }) => {
  const res = await request.get(`${API_URL}/v1/health`, { timeout: 15_000 });
  expect(res.ok(), `API ${API_URL}/v1/health must be up for e2e`).toBeTruthy();
});

for (const role of Object.keys(ROLES) as Role[]) {
  setup(`storage state: ${role}`, async () => {
    mkdirSync(AUTH_DIR, { recursive: true });
    try {
      await saveRoleState(ROLES[role], storageStateFor(role));
    } catch (e) {
      // A missing demo account must not block the whole suite; specs using this role will fail loudly.
      console.warn(`[e2e setup] could not log in as ${role}: ${(e as Error).message}`);
      setup.info().annotations.push({ type: 'warning', description: `login failed for ${role}` });
    }
  });
}
