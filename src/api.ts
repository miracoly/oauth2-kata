import { get, post } from "./ragettp/ragettp";

get("/", (_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write("Hello, World! - GET");
});

post("/", (_, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.write("Hello, World! POST");
});
