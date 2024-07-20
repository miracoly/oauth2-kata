import type { RequestListener } from "http";
import { createLogger, format, Logger, transports } from "winston";

type Path = string;
type HttpMethod = "GET" | "POST";

type Endpoint = (path: string, handler: RequestListener) => void;

type Api = {
  [key: string]: Endpoint;
};

const initLogger: () => Logger = () => {
  const { printf, timestamp, combine, colorize } = format;
  const serverFormat = printf(({ level, message, timestamp }) => {
    return `[${timestamp} - ${level}]: ${message}`;
  });

  return createLogger({
    level: "info",
    transports: [new transports.Console()],
    format: combine(timestamp(), serverFormat, colorize({ all: true })),
  });
};

const _logger = initLogger();

const createRouterGroup = (method: HttpMethod, logger: Logger) => {
  const endpoints = new Map<Path, RequestListener>();

  const router: RequestListener = (req, res) => {
    const handler = endpoints.get(req.url);
    typeof handler === "function" ? handler(req, res) : notFound(req, res);
  };

  const handler: Endpoint = (path, handler) => {
    const logAndHandle: RequestListener = (req, res) => {
      logger.info(`${method} - Request on path: ${req.url}`);
      handler(req, res);
    };
    endpoints.set(path, logAndHandle);
  };

  return [router, handler] as const;
};

const methodNotAllowed: RequestListener = (_, res) => {
  res.writeHead(405, { "Content-Type": "text/plain" });
  res.write("Method Not Allowed");
};
const notFound: RequestListener = (_, res) => {
  res.writeHead(404, { "Content-Type": "text/plain" });
  res.write("Not Found");
};

const [GET, _get] = createRouterGroup("GET", _logger);

const [POST, _post] = createRouterGroup("POST", _logger);

/**
 * Create a GET endpoint
 *
 * @example
 * get("/", (_, res) => {
 *   res.writeHead(200, { "Content-Type": "text/plain" });
 *   res.write("Hello, World! - GET");
 * });
 */
export const get = _get;

/**
 * Create a POST endpoint
 *
 * @example
 * post("/", (_, res) => {
 *   res.writeHead(200, { "Content-Type": "text/plain" });
 *   res.write("Hello, World! POST");
 * });
 */
export const post = _post;

export const handleRequestsWith: (api: Api) => RequestListener =
  (_) => (req, res) => {
    switch (req.method) {
      case "GET":
        GET(req, res);
        break;
      case "POST":
        POST(req, res);
        break;
      default:
        methodNotAllowed(req, res);
    }
  };

export const logger = _logger;
