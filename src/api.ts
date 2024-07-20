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

const { createSession } = initSessionMap();

get("/", async (_, res) => {
  const index = await readFile("./public/index.html");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.write(index);
  res.end();
});

get("/secret.html", async (_, res) => {
  const secret = await readFile("./public/secret.html");
  res.writeHead(200, { "Content-Type": "text/html" });
  res.write(secret);
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
    "todo",
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
  res.writeHead(302, {
    Location: "http://localhost:8080",
    "Set-Cookie": cookie,
  });
  res.end();
});
