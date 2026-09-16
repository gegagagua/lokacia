import next from '@lokacia/config/eslint-next';

// packages/ui is framework-agnostic React: <img> is intentional (apps wrap with next/image where needed).
export default [...next, { rules: { '@next/next/no-img-element': 'off' } }];
