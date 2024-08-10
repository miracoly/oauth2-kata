import { z } from "zod";
import crypto from "crypto";

const WellKnownEndpoints = z.object({
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
  end_session_endpoint: z.string(),
});

type WellKnownEndpoints = z.infer<typeof WellKnownEndpoints>;

const wellKnown: (
  wellKnownPath: string,
) => Promise<WellKnownEndpoints> = async (wellKnownPath) => {
  const response = await fetch(wellKnownPath);
  const data = await response.json();
  return WellKnownEndpoints.parse(data);
};

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

const codeVerifier = "03f588de8bb2abf9e2e1fdc0fc26afb94ce70500d5cad17c5e5ed08f";

export const mkAuthCodeRequest: (
  authUrl: string,
  redirectUrl: string,
  clientId: string,
) => Request = (authUrl, redirectUrl, clientId) => {
  const url = new URL(authUrl);
  const codeChallenge1 = generateCodeChallenge(codeVerifier);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    state: "blakeks",
    redirect_uri: redirectUrl,
    code_challenge: codeChallenge1,
    code_challenge_method: "S256",
    scope: "openid",
  }).toString();
  return new Request(url, { method: "GET" });
};

export const mkTokenRequest: (tokenUrl: string, code: string) => Request = (
  tokenUrl,
  code,
) => {
  const payload = {
    grant_type: "authorization_code",
    redirect_uri: "http://localhost:8080/api/signin/callback",
    client_id: "oauth2-kata",
    client_secret: "super-secret",
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
