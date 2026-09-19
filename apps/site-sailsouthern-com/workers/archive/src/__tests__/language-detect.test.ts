import { describe, it, expect } from "vitest";
import { detectLanguage } from "../lib/language-detect.js";

describe("detectLanguage", () => {
  it("detects English", () => {
    expect(detectLanguage(
      "The race started at dawn with fifteen boats competing for the championship trophy.",
      {}
    )).toBe("en");
  });

  it("detects Italian", () => {
    expect(detectLanguage(
      "La regata è iniziata all'alba con quindici barche in gara per il trofeo.",
      {}
    )).toBe("it");
  });

  it("detects German", () => {
    expect(detectLanguage(
      "Das Rennen begann bei Tagesanbruch mit fünfzehn Booten, die um die Meisterschaft kämpften.",
      {}
    )).toBe("de");
  });

  it("prefers hreflang hint over body detection", () => {
    expect(detectLanguage("hello world", { hreflang: "fr" })).toBe("fr");
  });

  it("falls back to TLD hint when body is too short", () => {
    expect(detectLanguage("sail", { tld: "de" })).toBe("de");
  });

  it("defaults to en when detection is uncertain", () => {
    expect(detectLanguage("", {})).toBe("en");
  });
});
