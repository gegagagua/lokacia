'use client';
import * as React from 'react';
import NextLink from 'next/link';
import { useLocale } from 'next-intl';
import { localizePath, toLocale } from './locale';

type Props = React.ComponentProps<typeof NextLink> & { /** Link to another language version (defaults to the active locale). */ locale?: string };

/**
 * Drop-in `next/link` replacement that prefixes internal hrefs with the active public locale (/en, /ru; ka stays at the root).
 * React 19: `ref` is a regular prop and is forwarded with the rest.
 */
export function LocaleLink({ href, locale, ...rest }: Props) {
  const current = useLocale();
  const active = toLocale(locale ?? current);
  const localized = typeof href === 'string' ? localizePath(href, active) : href.pathname ? { ...href, pathname: localizePath(href.pathname, active) } : href;
  return <NextLink href={localized} {...rest} />;
}

export default LocaleLink;

/** Client hook: `const lp = useLocalizedPath(); router.push(lp('/search'))`. */
export function useLocalizedPath() {
  const locale = toLocale(useLocale());
  return React.useCallback((href: string) => localizePath(href, locale), [locale]);
}
