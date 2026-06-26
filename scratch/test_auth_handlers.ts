import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import { handlers } from '../src/auth';

async function main() {
  console.log("Handlers imported successfully");
  console.log("GET handler type:", typeof handlers?.GET);
  console.log("POST handler type:", typeof handlers?.POST);
  console.log("All handlers keys:", Object.keys(handlers || {}));
  process.exit(0);
}

main().catch(console.error);
