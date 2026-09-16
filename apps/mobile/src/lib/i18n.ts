import ka from '../../messages/ka/app.json';

type Messages = typeof ka;
type Leaves<T, P extends string = ''> = {
  [K in keyof T & string]: T[K] extends string ? `${P}${K}` : Leaves<T[K], `${P}${K}.`>;
}[keyof T & string];

/** Every message key, e.g. `search.title`. Strings live in messages/ka/app.json (validated by `pnpm check:ka`). */
export type MessageKey = Leaves<Messages>;
export type MessageVars = Record<string, string | number>;

export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
}

export function lookup(messages: unknown, key: string): string | undefined {
  let cur: unknown = messages;
  for (const part of key.split('.')) {
    if (cur && typeof cur === 'object' && part in cur) cur = (cur as Record<string, unknown>)[part];
    else return undefined;
  }
  return typeof cur === 'string' ? cur : undefined;
}

/** Georgian is the primary UI language (CLAUDE.md); en/ru files are empty placeholders. */
export function t(key: MessageKey, vars?: MessageVars): string {
  return interpolate(lookup(ka, key) ?? key, vars);
}
