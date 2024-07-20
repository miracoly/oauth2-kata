import { get } from "./ragettp/ragettp";
import {
  mkAuthCodeRequest,
  mkTokenRequest,
  parseAuthResponseUrl,
  wellKnownKeycloak,
} from "./authlib/authlib";
import { readFile } from "node:fs/promises";

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

get("/api/signin/callback", async (req, res) => {
  const wellKnown = await wellKnownKeycloak("http://localhost:8888", "kb");
  const authResponse = parseAuthResponseUrl(req.url);
  const request = mkTokenRequest(wellKnown.token_endpoint, authResponse.code);
  const response = await fetch(request);
  const json = await response.json();
  console.log("json", json);
  res.writeHead(307, { Location: "http://localhost:8080" });
  res.end();
});
