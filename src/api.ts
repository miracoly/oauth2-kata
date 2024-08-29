import { get } from "./ragettp";
import {
  initAuthCodeMap,
  initSessionMap,
  mkAuthCodeRequest,
  mkTokenRequest,
  parseAuthResponseUrl,
  parseIdToken,
  wellKnownKeycloak,
} from "./authlib";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { mkCookie, parseCookies } from "./ragettp/cookie";
import { fetcher } from "./ragettp/fetch";

const CLIENT_ID = "oauth2-kata";
const CLIENT_SECRET = "super-secret";

const { createSession, exists, deleteSession } = initSessionMap();
const { createAuthCode, getAuthCode, deleteAuthCode } = initAuthCodeMap();

get("/", async (_, res) => {
  const index = await readFile("./public/index.html");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.write(index);
  res.end();
});

get("/secret.html", async (req, res) => {
  const cookieString = req.headers.cookie;
  const cookies = parseCookies(cookieString);
  if (cookies.sessionId && exists(cookies.sessionId)) {
    const secret = await readFile("./public/secret.html");
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write(secret);
  } else {
    res.writeHead(307, { Location: "/api/signin" });
  }
  res.end();
});

get("/styles.css", async (_, res) => {
  const css = await readFile("./public/styles.css");
  res.writeHead(200, { "Content-Type": "text/css" });
  res.write(css);
  res.end();
});

get("/api/signin", async (_, res) => {
  const wellKnown = await wellKnownKeycloak("http://localhost:8888", "kb");
  const redirectUrl = "http://localhost:8080/api/signin/callback";

  const request = mkAuthCodeRequest(
    wellKnown.authorization_endpoint,
    redirectUrl,
    CLIENT_ID,
    createAuthCode(redirectUrl),
  );

  res.writeHead(307, { Location: request.url });
  res.end();
});

const TokenResponse = z.object({
  access_token: z.string(),
  expires_in: z.number(),
  id_token: z.string(),
  refresh_expires_in: z.number(),
  refresh_token: z.string(),
  scope: z.string(),
  session_state: z.string(),
  token_type: z.string(),
});

type TokenResponse = z.infer<typeof TokenResponse>;

get("/api/signin/callback", async (req, res) => {
  const wellKnown = await wellKnownKeycloak("http://localhost:8888", "kb");
  const authResponse = parseAuthResponseUrl(req.url);
  const { codeVerifier, redirectUrl } = getAuthCode(authResponse.state);

  const request = mkTokenRequest(
    wellKnown.token_endpoint,
    redirectUrl,
    CLIENT_ID,
    CLIENT_SECRET,
    authResponse.code,
    codeVerifier,
  );

  const token: TokenResponse = await fetcher(TokenResponse)(request);
  const idToken = parseIdToken(token.id_token);

  const sessionId = createSession(idToken);
  const cookie = mkCookie("sessionId", sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "Strict",
    path: "/",
    expires: new Date(Date.now() + 1000 * 60 * 60),
  });

  deleteAuthCode(authResponse.state);

  res.writeHead(302, {
    "Set-Cookie": cookie,
    Location: "http://localhost:8080",
  });
  res.end();
});

const mkLogoutUrl: (
  endSessionEndpoint: string,
  redirectUrl: string,
  clientId: string,
) => string = (endSessionEndpoint, redirectUrl, clientId) =>
  `${endSessionEndpoint}?post_logout_redirect_uri=${redirectUrl}&client_id=${clientId}`;

get("/api/signout", async (_, res) => {
  const { end_session_endpoint } = await wellKnownKeycloak(
    "http://localhost:8888",
    "kb",
  );
  const redirectUrl = encodeURIComponent(
    "http://localhost:8080/api/signout/callback",
  );

  const logoutUrl = mkLogoutUrl(end_session_endpoint, redirectUrl, CLIENT_ID);

  res.writeHead(307, { Location: logoutUrl });
  res.end();
});

get("/api/signout/callback", async (req, res) => {
  const sessionId = parseCookies(req.headers.cookie).sessionId;
  deleteSession(sessionId);
  const cookie = mkCookie("sessionId", "", {
    httpOnly: true,
    secure: false,
    sameSite: "Strict",
    path: "/",
    expires: new Date(Date.now() - 1000),
  });
  res.writeHead(307, {
    "Set-Cookie": cookie,
    Location: "http://localhost:8080",
  });
  res.end();
});
