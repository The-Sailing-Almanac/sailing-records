const fs = require("fs");
const path = require("path");

const testsDir = path.resolve(__dirname, "../apps/api/src/__tests__");
const files = fs.readdirSync(testsDir);

for (const file of files) {
  if (!file.endsWith(".test.ts")) continue;
  const filePath = path.join(testsDir, file);
  let content = fs.readFileSync(filePath, "utf-8");

  console.log(`Updating test file: ${file}`);

  // Replace error/code assertions
  content = content.replace(/expect\(res\.body\.code\)/g, "expect(res.body.error.code)");
  content = content.replace(/expect\(res\.body\.error\)\.toBe\(/g, "expect(res.body.error.message).toBe(");
  content = content.replace(/expect\(res\.body\.error\)\.toContain\(/g, "expect(res.body.error.message).toContain(");

  // Replace endpoint URLs with v1 versioned endpoints
  // Specifically map singular newsletter to newsletters
  content = content.replace(/"\/api\/newsletter/g, '"/api/v1/newsletters');
  
  const replacements = [
    { from: '"/api/boats', to: '"/api/v1/boats' },
    { from: '"/api/editions', to: '"/api/v1/editions' },
    { from: '"/api/entities', to: '"/api/v1/entities' },
    { from: '"/api/subscribe', to: '"/api/v1/subscribe' },
    { from: '"/api/submissions', to: '"/api/v1/submissions' },
    { from: '"/api/admin', to: '"/api/v1/admin' },
    { from: '"/api/handicap', to: '"/api/v1/handicap' },
    { from: '"/api/search', to: '"/api/v1/search' },
    { from: '"/api/status', to: '"/api/v1/status' },
    { from: '"/api/ticker', to: '"/api/v1/ticker' },
    { from: '"/api/feeds', to: '"/api/v1/feeds' },
    { from: '"/api/bulletins', to: '"/api/v1/bulletins' },
    { from: '"/api/tribes', to: '"/api/v1/tribes' }
  ];

  for (const rep of replacements) {
    // Avoid double-versioning if /api/v1 is already present
    const regex = new RegExp(rep.from.replace(/[\/]/g, "\\/"), "g");
    content = content.replace(regex, rep.to);
  }

  // Double-check and correct any duplicate v1 references
  content = content.replace(/\/api\/v1\/v1\//g, "/api/v1/");

  fs.writeFileSync(filePath, content, "utf-8");
}
console.log("All test files updated!");
