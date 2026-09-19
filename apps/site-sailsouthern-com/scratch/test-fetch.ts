async function test() {
  try {
    const url = "https://web.archive.org/cdx/search/cdx?url=sailboatdata.com/sailboat/*&output=json&collapse=urlkey&limit=500";
    console.log("Fetching CDX from:", url);
    const res = await fetch(url);
    const data = await res.json() as string[][];
    
    // Original URL is at index 2 (skipping header row)
    const urls = data.slice(1).map(row => row[2]);
    console.log("Total unique URLs returned:", urls.length);
    
    // Filter to individual sailboat design pages (e.g. they should have something after /sailboat/)
    const designPages = urls.filter(u => {
      try {
        const urlObj = new URL(u);
        const pathParts = urlObj.pathname.split('/').filter(Boolean);
        // Path should be like /sailboat/catalina-30
        return pathParts.length >= 2 && pathParts[0] === 'sailboat' && pathParts[1] !== 'page';
      } catch {
        return false;
      }
    });
    
    console.log("Filtered design pages count:", designPages.length);
    console.log("Sample design pages:");
    designPages.slice(0, 30).forEach(u => console.log("  -", u));
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
