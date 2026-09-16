// Pure helpers for scripts/i18n-check.mjs (unit-tested in scripts/i18n-check.test.mjs).

export const GEORGIAN = /[Ⴀ-ჿᲐ-Ჿⴀ-⴯]/u;

/**
 * Collects ICU arguments ("name:type") and rich-text tags ("<b>") of a message.
 * Plural/select option keys are NOT compared — languages have different plural categories (ru: one/few/many/other).
 * Throws on unbalanced braces.
 */
export function icuSignature(message) {
  const out = new Set();
  let i = 0;
  const s = String(message);

  function readUntil(stops) {
    let buf = '';
    while (i < s.length && !stops.includes(s[i])) buf += s[i++];
    return buf.trim();
  }

  // parses message text until an unmatched "}" (depth > 0) or end of string
  function parseMessage(depth) {
    while (i < s.length) {
      const ch = s[i];
      if (ch === "'" && (s[i + 1] === '{' || s[i + 1] === '}')) {
        // ICU quoting: '{' literal … skip to closing quote
        const end = s.indexOf("'", i + 1);
        i = end === -1 ? s.length : end + 1;
      } else if (ch === '{') {
        i++;
        parseArgument();
      } else if (ch === '}') {
        if (depth === 0) throw new Error(`unbalanced "}" at ${i}`);
        i++;
        return;
      } else if (ch === '<') {
        const m = /^<\/?([A-Za-z][\w-]*)\s*\/?>/.exec(s.slice(i));
        if (m) {
          if (!m[0].startsWith('</')) out.add(`<${m[1]}>`);
          i += m[0].length;
        } else i++;
      } else i++;
    }
    if (depth > 0) throw new Error('unbalanced "{"');
  }

  function parseArgument() {
    const name = readUntil([',', '}']);
    if (s[i] === '}') {
      i++;
      out.add(name);
      return;
    }
    i++; // ,
    const type = readUntil([',', '}']);
    out.add(`${name}:${type}`);
    if (s[i] === '}') {
      i++;
      return;
    }
    i++; // ,
    if (type === 'plural' || type === 'select' || type === 'selectordinal') {
      // options: key {message} key {message} … }
      for (;;) {
        readUntil(['{', '}']);
        if (i >= s.length) throw new Error('unbalanced "{"');
        if (s[i] === '}') {
          i++;
          return;
        }
        i++; // {
        parseMessage(1);
      }
    } else {
      // number/date style — skip to matching }
      readUntil(['}']);
      if (i >= s.length) throw new Error('unbalanced "{"');
      i++;
    }
  }

  parseMessage(0);
  return [...out].sort();
}

/** Flattens a message tree to { "a.b.c": value }. Non-string leaves are kept as-is so the caller can report them. */
export function flatten(obj, prefix = '', out = {}) {
  for (const [k, v] of Object.entries(obj ?? {})) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (v && typeof v === 'object' && !Array.isArray(v)) flatten(v, key, out);
    else out[key] = v;
  }
  return out;
}

/**
 * Compares a translation tree with the ka source tree. Returns a list of human-readable problems.
 * @param {object} source ka messages
 * @param {object} target en/ru messages
 */
export function compareTrees(source, target) {
  const problems = [];
  const src = flatten(source);
  const dst = flatten(target);
  for (const [key, kaValue] of Object.entries(src)) {
    if (!(key in dst)) {
      problems.push(`${key}: missing key`);
      continue;
    }
    const v = dst[key];
    if (typeof v !== 'string') {
      problems.push(`${key}: not a string`);
      continue;
    }
    if (v.trim() === '') {
      problems.push(`${key}: empty string`);
      continue;
    }
    if (GEORGIAN.test(v)) problems.push(`${key}: contains Georgian letters`);
    let a;
    let b;
    try {
      a = icuSignature(kaValue);
    } catch (e) {
      problems.push(`${key}: ka source has invalid ICU (${e.message})`);
      continue;
    }
    try {
      b = icuSignature(v);
    } catch (e) {
      problems.push(`${key}: invalid ICU (${e.message})`);
      continue;
    }
    if (a.join('|') !== b.join('|')) problems.push(`${key}: placeholders differ (ka: ${a.join(', ') || '—'}; got: ${b.join(', ') || '—'})`);
  }
  for (const key of Object.keys(dst)) if (!(key in src)) problems.push(`${key}: extra key`);
  return problems;
}
