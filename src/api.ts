import { get } from "./ragettp";
import { initAuthCodeMap, initSessionMap } from "./authlib";
import { readFile } from "node:fs/promises";
import { z } from "zod";

const CLIENT_ID = ""; // TODO Look up in the Keycloak Admin Console
const CLIENT_SECRET = ""; // TODO Look up in the Keycloak Admin Console

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

  // TODO Protecting the Secret Page

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
  // TODO Logging In

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
  // TODO Exchanging the Code for Tokens

  // TODO Establish a Session

  res.end();
});

const mkLogoutUrl: (
  endSessionEndpoint: string,
  redirectUrl: string,
  clientId: string,
) => string = (endSessionEndpoint, redirectUrl, clientId) =>
  `${endSessionEndpoint}?post_logout_redirect_uri=${redirectUrl}&client_id=${clientId}`;

get("/api/signout", async (_, res) => {
  const redirectUrl = encodeURIComponent(
    "http://localhost:8080/api/signout/callback",
  );

  // TODO Logging Out

  res.end();
});

get("/api/signout/callback", async (req, res) => {
  // TODO Clearing the Session

  res.end();
});
