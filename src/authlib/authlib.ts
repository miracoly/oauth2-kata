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
