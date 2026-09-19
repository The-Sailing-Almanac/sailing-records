import { describe, it, expect } from "vitest";
import { 
  renderMastodon, 
  renderNostr, 
  renderBluesky, 
  CanonicalMicroNewsletter 
} from "../../../../packages/activity-core/src/social-archive";

describe("Micro-Newsletter Renderers", () => {
  const sampleNews: CanonicalMicroNewsletter = {
    title: "Weekend Regatta Report",
    summary: "Yale secure fleet racing championships in light air conditions. Winds average 5-8 knots.",
    key_links: [
      { label: "Full Results", url: "https://sailsouthern.com/results/yale-fleet" },
      { label: "Gallery", url: "https://sailsouthern.com/gallery/yale-fleet" }
    ],
    call_to_action: "Join our forum for analysis.",
    tags: ["Sailing", "Regatta", "yale"]
  };

  it("should render Mastodon post with limits and tags correctly", () => {
    const output = renderMastodon(sampleNews);
    expect(output).toContain("🗞️ Weekend Regatta Report");
    expect(output).toContain("Yale secure fleet racing championships");
    expect(output).toContain("Read more:");
    expect(output).toContain("Full Results: https://sailsouthern.com/results/yale-fleet");
    expect(output).toContain("Gallery: https://sailsouthern.com/gallery/yale-fleet");
    expect(output).toContain("Join our forum for analysis.");
    expect(output).toContain("#sailing #regatta #yale");
    expect(output.length).toBeLessThanOrEqual(500);
  });

  it("should truncate Mastodon output if it exceeds 500 characters", () => {
    const longNews: CanonicalMicroNewsletter = {
      title: "Extremely Long Title for Testing Truncation Behavior of Mastodon Render Functionality",
      summary: "A".repeat(450),
      key_links: [{ url: "https://example.com/very-long-url-for-testing" }],
      tags: ["verylongtag"]
    };
    const output = renderMastodon(longNews);
    expect(output.endsWith("...")).toBe(true);
    expect(output.length).toBe(500);
  });

  it("should render Nostr Kind-1 structure and tag array", () => {
    const output = renderNostr(sampleNews);
    expect(output.content).toContain("🗞️ Weekend Regatta Report");
    expect(output.content).toContain("Full Results: https://sailsouthern.com/results/yale-fleet");
    expect(output.tags).toEqual([
      ["t", "sailing"],
      ["t", "regatta"],
      ["t", "yale"]
    ]);
  });

  it("should render Bluesky post with single link and character limit", () => {
    const output = renderBluesky(sampleNews);
    expect(output).toContain("🗞️ Weekend Regatta Report");
    expect(output).toContain("Read: https://sailsouthern.com/results/yale-fleet");
    expect(output).not.toContain("Gallery: https://sailsouthern.com/gallery/yale-fleet");
    expect(output).toContain("#sailing #regatta #yale");
    expect(output.length).toBeLessThanOrEqual(300);
  });

  it("should truncate Bluesky output if it exceeds 300 characters", () => {
    const longNews: CanonicalMicroNewsletter = {
      title: "Bluesky Title",
      summary: "B".repeat(280),
      key_links: [{ url: "https://example.com" }]
    };
    const output = renderBluesky(longNews);
    expect(output.endsWith("...")).toBe(true);
    expect(output.length).toBe(300);
  });
});
