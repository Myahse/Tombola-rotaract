import "dotenv/config";
import { client } from "./db/index.js";

const deleted = await client`
  DELETE FROM rate_limits
  WHERE key LIKE 'login:%'
     OR key LIKE 'register:%'
     OR key LIKE 'buy:%'
     OR key LIKE 'cancel:%'
  RETURNING key
`;

console.log(`Cleared ${deleted.length} rate-limit row(s).`);
process.exit(0);
