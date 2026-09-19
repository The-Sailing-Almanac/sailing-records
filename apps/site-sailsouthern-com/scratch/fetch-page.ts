import fs from "fs";

async function main() {
  try {
    const url = "https://web.archive.org/web/https://sailboatdata.com/sailboat/11-meter";
    console.log("Fetching page:", url);
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });
    if (!res.ok) {
      throw new Error(`HTTP error: ${res.status}`);
    }
    const html = await res.text();
    fs.writeFileSync("scratch/sample-page.html", html, "utf-8");
    console.log("Saved page HTML to scratch/sample-page.html");
  } catch (err) {
    console.error("Error:", err);
  }
}
main();
