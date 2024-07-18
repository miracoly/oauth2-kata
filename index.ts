import { createServer } from "http";
import { handleRequestsWith, logger } from "./src/ragettp/ragettp";
import * as api from "./src/api";

const port = 8080;

createServer(handleRequestsWith(api)).listen(port);

logger.info(`Server started on port ${port}`);
logger.info(`Listening for requests ...`);
