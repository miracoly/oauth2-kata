import { z } from "zod";

const WellKnownEndpoints = z.object({
  authorization_endpoint: z.string(),
  token_endpoint: z.string(),
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

export const mkAuthCodeRequest: (
  authUrl: string,
  redirectUrl: string,
  clientId: string,
  codeChallenge: string,
) => string = (authUrl, redirectUrl, clientId, codeChallenge) => {
  const url = new URL(authUrl);
  url.search = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    state: "blakeks",
    redirect_uri: redirectUrl,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
    scope: "openid",
  }).toString();
  return url.toString();
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
    code_verifier: "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
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
