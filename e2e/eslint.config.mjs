import base from '@lokacia/config/eslint';

export default [...base, { ignores: ['test-results/**', 'playwright-report/**', '.auth/**'] }];
