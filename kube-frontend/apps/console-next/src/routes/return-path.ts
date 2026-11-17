/**
 * A same-origin absolute path, or `null` for anything that could leave it.
 *
 * `//host` and `/\host` are both read as protocol-relative by browsers, and the value comes from the
 * query string, so it is attacker-controlled.
 *
 * Lives in its own module with no imports: the login route also imports the page component, and a
 * module that pulls in `@/…` cannot be loaded by the contract tests that pin this guard.
 */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//') || trimmed.startsWith('/\\')) return null;
  return trimmed;
}
