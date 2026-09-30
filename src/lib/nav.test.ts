import { describe, expect, it } from "vitest";
import { canGoBack } from "./nav";

describe("canGoBack", () => {
  it("true ab dem zweiten App-Eintrag", () => {
    expect(canGoBack({ idx: 1 })).toBe(true);
    expect(canGoBack({ idx: 7, usr: null, key: "abc" })).toBe(true);
  });

  it("false beim ersten Eintrag (Direkteinstieg per Link, Push oder Reload)", () => {
    expect(canGoBack({ idx: 0 })).toBe(false);
  });

  it("false ohne oder mit fremdem History-State", () => {
    expect(canGoBack(null)).toBe(false);
    expect(canGoBack(undefined)).toBe(false);
    expect(canGoBack({})).toBe(false);
    expect(canGoBack({ idx: null })).toBe(false);
    expect(canGoBack({ idx: "3" })).toBe(false);
    expect(canGoBack({ idx: Number.NaN })).toBe(false);
    expect(canGoBack("state")).toBe(false);
  });
});
