import { get, post } from "./ragettp/ragettp";
import { wellKnownKeycloak } from "./authlib/authlib";

get("/", async (_, res) => {
  const wellKnown = await wellKnownKeycloak("http://localhost:8888", "kb");
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write(JSON.stringify(wellKnown));
  res.end();
});

post("/", (_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write("Hello, World! POST");
  res.end();
});
