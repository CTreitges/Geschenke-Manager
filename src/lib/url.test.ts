import { describe, expect, it } from "vitest";
import { hostLabel, normalizeUrl } from "./url";

describe("normalizeUrl", () => {
  it("ergänzt fehlendes Schema zu https://", () => {
    expect(normalizeUrl("amazon.de/dp/B0C123")).toBe("https://amazon.de/dp/B0C123");
    expect(normalizeUrl(" www.keramik.de ")).toBe("https://www.keramik.de/");
    expect(normalizeUrl("//shop.example.com/x")).toBe("https://shop.example.com/x");
    expect(normalizeUrl("amazon.de:8080/x")).toBe("https://amazon.de:8080/x");
  });

  it("lässt http und https stehen", () => {
    expect(normalizeUrl("https://amazon.de/dp/1?tag=a")).toBe("https://amazon.de/dp/1?tag=a");
    expect(normalizeUrl("http://example.org")).toBe("http://example.org/");
    expect(normalizeUrl("HTTPS://Example.ORG/Pfad")).toBe("https://example.org/Pfad");
  });

  it("verweigert andere Schemata", () => {
    expect(normalizeUrl("javascript:alert(1)")).toBeUndefined();
    expect(normalizeUrl(" JavaScript:alert(1)")).toBeUndefined();
    expect(normalizeUrl("javascript://%0aalert(1)")).toBeUndefined();
    expect(normalizeUrl("data:text/html,hi")).toBeUndefined();
    expect(normalizeUrl("mailto:anna@example.com")).toBeUndefined();
    expect(normalizeUrl("ftp://example.com/file")).toBeUndefined();
    expect(normalizeUrl("tel:+43123")).toBeUndefined();
  });

  it("leer, Leerzeichen im Host oder Host ohne Punkt → undefined", () => {
    expect(normalizeUrl("")).toBeUndefined();
    expect(normalizeUrl("   ")).toBeUndefined();
    expect(normalizeUrl(undefined)).toBeUndefined();
    expect(normalizeUrl(null)).toBeUndefined();
    expect(normalizeUrl("amazon .de")).toBeUndefined();
    expect(normalizeUrl("Kopfhörer")).toBeUndefined();
    expect(normalizeUrl("https://")).toBeUndefined();
    expect(normalizeUrl("localhost")).toBeUndefined();
  });
});

describe("hostLabel", () => {
  it("zeigt den Host ohne www.", () => {
    expect(hostLabel("https://www.amazon.de/dp/123")).toBe("amazon.de");
    expect(hostLabel("keramik.de")).toBe("keramik.de");
    expect(hostLabel("https://shop.WWW.example.com")).toBe("shop.www.example.com");
  });

  it("undefined bei ungültigen Links", () => {
    expect(hostLabel("javascript:alert(1)")).toBeUndefined();
    expect(hostLabel("")).toBeUndefined();
    expect(hostLabel(undefined)).toBeUndefined();
  });
});
