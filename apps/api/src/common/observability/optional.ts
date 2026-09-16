/**
 * Loads an optional runtime dependency. Observability SDKs are NOT project dependencies
 * (kept out to stay light); production images install them when the matching env var is set.
 * Returns null when the package is not installed.
 */
export function optionalRequire<T = unknown>(name: string): T | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require(name) as T;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'MODULE_NOT_FOUND') return null;
    throw e;
  }
}

export function warn(msg: string) {
  // Runs before the Nest logger exists — plain structured line on stderr.
  process.stderr.write(`${JSON.stringify({ level: 40, time: Date.now(), context: 'Observability', msg })}\n`);
}
