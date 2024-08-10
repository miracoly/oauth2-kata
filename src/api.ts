import { get } from "./ragettp/ragettp";
import {
  initSessionMap,
  mkAuthCodeRequest,
  mkCookie,
  mkTokenRequest,
  parseAuthResponseUrl,
  parseIdToken,
  wellKnownKeycloak,
} from "./authlib/authlib";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const { createSession, exists, deleteSession } = initSessionMap();

const parseCookies: (cookieString: string) => Record<string, string> = (
  cookieString = "",
) => {
  const cookies: Record<string, string> = {};
  cookieString.split(";").forEach((cookie) => {
    const [name, ...value] = cookie.trim().split("=");
    cookies[name] = value.join("=");
  });
  return cookies;
};

get("/", async (_, res) => {
  const index = await readFile("./public/index.html");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.write(index);
  res.end();
});

get("/secret.html", async (req, res) => {
  const cookieString = req.headers.cookie;
  console.log("cookieString", cookieString);
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
  const request = mkAuthCodeRequest(
    wellKnown.authorization_endpoint,
    "http://localhost:8080/api/signin/callback",
    "oauth2-kata",
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
  const request = mkTokenRequest(wellKnown.token_endpoint, authResponse.code);
  const response = await fetch(request);
  const json = await response.json();
  const token: TokenResponse = TokenResponse.parse(json);
  const idToken = parseIdToken(token.id_token);
  const sessionId = createSession(idToken);
  const cookie = mkCookie("sessionId", sessionId, {
    httpOnly: true,
    secure: false,
    sameSite: "Strict",
    path: "/",
    expires: new Date(Date.now() + 1000 * 60 * 60),
  });

  res.setHeader("Set-Cookie", cookie);
  res.writeHead(302, { Location: "http://localhost:8080" });
  res.end();
});

get("/api/signout", async (_, res) => {
  const { end_session_endpoint } = await wellKnownKeycloak(
    "http://localhost:8888",
    "kb",
  );
  const clientId = "oauth2-kata";
  const redirectUrl = encodeURIComponent(
    "http://localhost:8080/api/signout/callback",
  );
  const logoutUrl = `${end_session_endpoint}?post_logout_redirect_uri=${redirectUrl}&client_id=${clientId}`;
  res.writeHead(307, { Location: logoutUrl });
  res.end();
});

get("/api/signout/callback", async (req, res) => {
  const sessionId = parseCookies(req.headers.cookie).sessionId;
  deleteSession(sessionId);
  res.writeHead(307, { Location: "http://localhost:8080" });
  res.end();
});
