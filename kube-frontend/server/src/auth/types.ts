/**
 * Shapes shared by the BFF and the app's login screen.
 *
 * The app's copies live in `@kube-ai-hub/api-client` (`session.ts` / `token.ts`);
 * they are not imported here because that package is DOM-typed and this server
 * compiles without the DOM lib. `test/auth-token.test.ts` pins the two decoders
 * to the same cases.
 */

/** The signed-in user, derived from the token rather than a second request. */
export interface SessionUser {
  /** The account name (`sub`), which is what ks-apiserver authorises against. */
  name: string;
  displayName?: string;
  email?: string;
  /**
   * `false` for a pre-registration account that has not set a password. The login
   * page must route it to password confirmation; the console would answer 403 on
   * every request.
   */
  initialized: boolean;
  /** Seconds since the epoch, when the issuer included it. */
  expiresAt?: number;
}

/** Successful login. */
export interface SessionResponse {
  token: string;
  user: SessionUser;
}

/**
 * Login failure.
 *
 * `code` is a stable identifier the page maps to a translated sentence; `message`
 * is what ks-apiserver said, kept for the console log and for the case where the
 * code is one this app does not recognise.
 */
export interface LoginErrorBody {
  code: 'invalid_credentials' | 'too_many_attempts' | 'upstream_unreachable' | 'invalid_request' | string;
  message: string;
  status: number;
}