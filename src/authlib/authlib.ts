import { z, ZodError } from "zod";
import crypto from "crypto";

const WellKnownEndpoints = z.object({
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  end_session_endpoint: z.string(),
});

type WellKnownEndpoints = z.infer<typeof WellKnownEndpoints>;

const wellKnown: (
  wellKnownPath: string,
) => Promise<WellKnownEndpoints> = async (wellKnownPath) =>
  await fetcher(WellKnownEndpoints)(wellKnownPath);

export const wellKnownKeycloak: (
  basePath: string,
  realm: string,
) => Promise<WellKnownEndpoints> = (basePath, realm) =>
  wellKnown(`${basePath}/realms/${realm}/.well-known/openid-configuration`);

const generateCodeChallenge: (codeVerifier: string) => string = (
  codeVerifier,
) => {
  const hash = crypto.createHash("sha256").update(codeVerifier).digest();
  return base64UrlEncode(hash);
};

const base64UrlEncode: (buffer: Buffer) => string = (buffer) =>
  buffer
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

const generateCodeVerifier: () => string = () => {
  let array = new Uint32Array(56 / 2);
  crypto.getRandomValues(array);
  return Array.from(array, dec2hex).join("");
};

const dec2hex = (dec: number) => ("0" + dec.toString(16)).substring(0, 2);

const generateState: () => string = () =>
  Math.random().toString(36).substring(2, 15) +
  Math.random().toString(36).substring(2, 15);

export type AuthCode = {
  state: string;
  codeVerifier: string;
};

export const mkAuthCodeRequest: (
  authUrl: string,
  redirectUrl: string,
  clientId: string,
  authCode: AuthCode,
) => Request = (authUrl, redirectUrl, clientId, { state, codeVerifier }) => {
  const url = new URL(authUrl);
  const codeChallenge = generateCodeChallenge(codeVerifier);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    state,
    redirect_uri: redirectUrl,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "openid",
  }).toString();
  return new Request(url, { method: "GET" });
};

export const mkTokenRequest: (
  tokenUrl: string,
  redirectUrl: string,
  clientId: string,
  clientSecret: string,
  code: string,
  codeVerifier: string,
) => Request = (
  tokenUrl,
  redirectUrl,
  clientId,
  clientSecret,
  code,
  codeVerifier,
) => {
  const payload = {
    grant_type: "authorization_code",
    redirect_uri: redirectUrl,
    client_id: clientId,
    client_secret: clientSecret,
    code_verifier: codeVerifier,
    code,
  };

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(payload)) {
    params.append(key, value);
  }

  return new Request(tokenUrl, {
    body: params.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    method: "POST",
  });
};

const AuthResponse = z.object({
  state: z.string(),
  session_state: z.string(),
  iss: z.string(),
  code: z.string(),
});

type AuthResponse = z.infer<typeof AuthResponse>;

export const parseAuthResponseUrl: (url: string) => AuthResponse = (url) => {
  const searchParams = new URL(url, "http://localhost:8080").searchParams;
  return AuthResponse.parse(Object.fromEntries(searchParams.entries()));
};

const IdToken = z.object({
  sub: z.string(),
  email: z.string(),
  email_verified: z.boolean(),
  preferred_username: z.string(),
  exp: z.number(),
  iat: z.number(),
});

type IdToken = z.infer<typeof IdToken>;

const decodeJwt: (token: string) => unknown = (token) =>
  JSON.parse(Buffer.from(token.split(".")[1], "base64").toString());

export const parseIdToken: (token: string) => IdToken = (token) =>
  IdToken.parse(decodeJwt(token));

export const generateSessionId: () => string = () =>
  crypto.randomBytes(16).toString("hex");

export const initAuthCodeMap = () => {
  type AuthCodeMapEntry = {
    codeVerifier: string;
    redirectUrl: string;
  };
  const authCodes = new Map<string, AuthCodeMapEntry>();

  const createAuthCode: (redirectUrl: string) => AuthCode = (redirectUrl) => {
    const state = generateState();
    const codeVerifier = generateCodeVerifier();
    authCodes.set(state, { redirectUrl, codeVerifier });
    return { state, codeVerifier };
  };

  const getAuthCode: (state: string) => AuthCodeMapEntry | null = (state) =>
    authCodes.get(state);

  const deleteAuthCode: (state: string) => void = (state) => {
    authCodes.delete(state);
  };

  return { createAuthCode, getAuthCode, deleteAuthCode };
};

export const initSessionMap = () => {
  const sessions = new Map<string, IdToken>();

  const createSession: (token: IdToken) => string = (token) => {
    const sessionId = generateSessionId();
    sessions.set(sessionId, token);
    return sessionId;
  };

  const exists: (sessionId: string) => boolean = (sessionId) =>
    sessions.has(sessionId);

  const deleteSession: (sessionId: string) => void = (sessionId) => {
    sessions.delete(sessionId);
  };

  return { createSession, exists, deleteSession };
};

type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: string;
  path?: string;
  expires?: Date;
};

export const mkCookie: (
  name: string,
  value: string,
  options?: CookieOptions,
) => string = (name, value, options = {}) => {
  let cookie = `${name}=${value}`;
  if (options.httpOnly) cookie += "; HttpOnly";
  if (options.path) cookie += `; Path=${options.path}`;
  if (options.secure) cookie += "; Secure";
  if (options.expires) cookie += `; Expires=${options.expires.toUTCString()}`;
  if (options.sameSite) cookie += `; SameSite=${options.sameSite}`;
  return cookie;
};

/**
 * Construct a fetcher that parses the response as a zod type
 * @param zType - The zod type to parse the response as, defaults to `void`
 * @returns A fetch function that returns a promise of the parsed response
 */
export const fetcher: <T extends z.ZodTypeAny>(
  zType: T,
) => (...args: Parameters<typeof fetch>) => Promise<z.infer<T>> =
  (zType) =>
  (url, ...args) =>
    fetch(url, ...args)
      .then((res) => res.json())
      .then((data) => zType.parse(data))
      .catch(handleFetchErrors(url));

const handleFetchErrors: (
  url: Parameters<typeof fetch>[0],
) => (e: Error) => void = (url) => (e) => {
  if (e instanceof ZodError) {
    console.error(e, url, e.errors);
  } else {
    console.error(e);
  }
  throw e;
};

export const _internal = {
  generateCodeChallenge,
};
