/**
 * Base64 for Secret values, matching the old console's `safeBtoa` / `safeAtob`.
 *
 * The browser's `btoa` takes a binary string and throws on anything above U+00FF,
 * so a passphrase with `é` or a certificate comment in Chinese failed to save —
 * the old console avoided that with `js-base64`. That library is AGPL-3.0, so the
 * same behaviour is rebuilt here on top of `TextEncoder`/`TextDecoder`: Secret
 * values are UTF-8 text, and kube-apiserver stores the raw bytes.
 *
 * Non-string input (the old helper's `typeof` guard) yields `''` so a form that
 * passes `undefined` for an untouched field does not write the string
 * "undefined" into a Secret.
 */

function utf8Encode(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let binary = '';
  // Chunked: `String.fromCharCode(...bytes)` overflows the argument limit for a
  // certificate bundle of a few hundred kilobytes.
  const CHUNK = 0x8000;
  for (let index = 0; index < bytes.length; index += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(index, index + CHUNK));
  }
  return binary;
}

export function safeBtoa(value: unknown): string {
  if (typeof value !== 'string') return '';
  if (value === '') return '';
  try {
    return btoa(utf8Encode(value));
  } catch {
    // A lone surrogate cannot be encoded; dropping just that character is better
    // than losing the whole value.
    const bytes = new TextEncoder().encode(value.replace(/[\uD800-\uDFFF]/g, '\uFFFD'));
    return btoa(String.fromCharCode(...bytes.subarray(0, 0x8000)) + String.fromCharCode(...bytes.subarray(0x8000)));
  }
}

/**
 * Decode a stored value to text.
 *
 * Values written by older consoles — and by `kubectl create secret` with a
 * non-UTF-8 payload — may not be valid UTF-8. Rather than rendering replacement
 * characters the decoder falls back to Latin-1, which is lossless for bytes.
 */
export function safeAtob(value: unknown): string {
  if (typeof value !== 'string' || value === '') return '';
  let binary: string;
  try {
    binary = atob(value);
  } catch {
    // Not base64 at all: show it as-is rather than an empty cell. This happens
    // when a Secret was written with `stringData` and the list cached it before
    // the server re-encoded it.
    return value;
  }
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return new TextDecoder('latin1').decode(bytes);
  }
}

/** Whether `value` decodes as UTF-8 base64 — used by the detail view to label binary content. */
export function isTextBase64(value: string): boolean {
  if (!value) return false;
  try {
    const binary = atob(value);
    new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(binary, (char) => char.charCodeAt(0)));
    return true;
  } catch {
    return false;
  }
}
