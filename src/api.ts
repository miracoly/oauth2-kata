import { get, post } from "./ragettp/ragettp";
import { mkAuthCodeRequest, wellKnownKeycloak } from "./authlib/authlib";
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
  console.log("requestUrl", requestUrl);
  res.writeHead(307, { Location: requestUrl });
  res.end();
});

get("/api/signin/callback", async (req, res) => {
  res.write(JSON.stringify({ url: req.url }));
  res.end();
});

post("/", (_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write("Hello, World! POST");
  res.end();
});
