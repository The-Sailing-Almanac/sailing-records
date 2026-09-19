const fs = require("fs");
const path = require("path");

const filePath = path.resolve(__dirname, "../apps/api/src/index.ts");
let content = fs.readFileSync(filePath, "utf-8");
let lines = content.split("\n");

console.log(`Original line count: ${lines.length}`);

function findLineIndex(pattern, startIdx = 0) {
  for (let i = startIdx; i < lines.length; i++) {
    if (pattern(lines[i], i)) {
      return i;
    }
  }
  return -1;
}

// 1. Identify Blocks
const b1Start = findLineIndex(line => line.includes("Basic Status Routes") || line.includes('app.get("/api/status"'));
const b1End = findLineIndex(line => line.includes("// ─── /health ───"));

const b2Start = findLineIndex(line => line.includes("Admin Heartbeat Telemetry Endpoint") || line.includes('app.get("/api/admin/heartbeat"'));
const b2End = findLineIndex(line => line.includes("GET /.well-known/webfinger"));

const b3Start = findLineIndex(line => line.includes("POST /api/entities/:slug/inbox"));
const b3End = findLineIndex(line => line.includes("WebSub / PubSubHubbub Publisher Helper"));

const b4Start = findLineIndex(line => line.includes("Submissions Endpoints"));
const b4End = findLineIndex(line => line.includes("app.use(errorHandler);"));

if (b1Start === -1 || b1End === -1 || b2Start === -1 || b2End === -1 || b3Start === -1 || b3End === -1 || b4Start === -1 || b4End === -1) {
  console.error("Could not find all blocks! Aborting.");
  process.exit(1);
}

// 2. Splice out blocks in reverse order to preserve line indices
console.log("Pruning Block 4...");
lines.splice(b4Start, b4End - b4Start);

console.log("Pruning Block 3...");
lines.splice(b3Start, b3End - b3Start);

console.log("Pruning Block 2...");
lines.splice(b2Start, b2End - b2Start);

console.log("Pruning Block 1...");
lines.splice(b1Start, b1End - b1Start);

content = lines.join("\n");

// 3. Insert v1Router import at the top of the file
const importTarget = 'import { ApiErrorResponse, ApiSuccessResponse } from "@almanac/types";';
if (!content.includes(importTarget)) {
  console.error("Could not find importTarget! Aborting.");
  process.exit(1);
}
content = content.replace(
  importTarget,
  `${importTarget}\nimport { v1Router } from "./routes/v1";`
);

// 4. Insert Router Mount and Rewrite Middleware after CORS setup
const corsTarget = `  allowedHeaders: ['Content-Type', 'Authorization', 'X-Admin-Key'],\n}));`;
if (!content.includes(corsTarget)) {
  console.error("Could not find CORS configuration target! Aborting.");
  process.exit(1);
}

const middlewareAndMount = `
// Legacy /api/* route re-writer for backwards compatibility
app.use((req, res, next) => {
  if (req.path.startsWith("/api/") && !req.path.startsWith("/api/v1/")) {
    const newPath = req.path.replace("/api/", "/api/v1/");
    logger.warn(\`[Deprecated API] Rewriting \${req.path} to \${newPath}\`);
    res.setHeader("Warning", \`299 - "Deprecated API endpoint. Use \${newPath} instead"\`);
    req.url = req.url.replace("/api/", "/api/v1/");
  }
  next();
});

app.use("/api/v1", v1Router);
`;

content = content.replace(
  corsTarget,
  `${corsTarget}\n${middlewareAndMount}`
);

// 5. Write back to file
fs.writeFileSync(filePath, content, "utf-8");
console.log("Pruning and configuration injection complete!");
console.log(`New line count: ${content.split("\n").length}`);
