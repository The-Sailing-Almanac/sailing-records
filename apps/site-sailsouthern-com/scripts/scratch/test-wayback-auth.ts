import dotenv from "dotenv";
import { fileURLToPath } from "url";
import path from "path";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

async function main() {
  const ak = process.env.WAYBACK_ACCESS_KEY;
  const sk = process.env.WAYBACK_SECRET_KEY;

  console.log("Access key present:", Boolean(ak));
  console.log("Secret key present:", Boolean(sk));

  const res = await fetch("https://web.archive.org/save/", {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json",
      "Authorization": "LOW " + ak + ":" + sk,
    },
    body: new URLSearchParams({ url: "https://sailsouthern.com" }),
  });

  console.log("SPN HTTP status:", res.status, res.statusText);
  const body = await res.text().catch(() => "");
  console.log("SPN response:", body.substring(0, 500));
}

main().catch(console.error);
