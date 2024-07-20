import { get } from "./ragettp/ragettp";
import {
  mkAuthCodeRequest,
  mkTokenRequest,
  parseAuthResponseUrl,
  wellKnownKeycloak,
} from "./authlib/authlib";
import { sha256 } from "js-sha256";

get("/", async (_, res) => {
  const wellKnown = await wellKnownKeycloak("http://localhost:8888", "kb");
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write(JSON.stringify(wellKnown));
  res.end();
});

get("/signin", async (_, res) => {
  const wellKnown = await wellKnownKeycloak("http://localhost:8888", "kb");
  const codeChallenge = sha256("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
  const requestUrl = mkAuthCodeRequest(
    wellKnown.authorization_endpoint,
    "http://localhost:8080/api/signin/callback",
    "oauth2-kata",
    codeChallenge,
  );
  res.writeHead(307, { Location: requestUrl });
  res.end();
});

get("/api/signin/callback", async (req, res) => {
  const wellKnown = await wellKnownKeycloak("http://localhost:8888", "kb");
  const authResponse = parseAuthResponseUrl(req.url);
  const request = mkTokenRequest(wellKnown.token_endpoint, authResponse.code);
  const response = await fetch(request);
  const json = await response.json();
  res.writeHead(307, { Location: "http://localhost:8080" });
  res.end();
});
