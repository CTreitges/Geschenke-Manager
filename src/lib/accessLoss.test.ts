import { describe, expect, it } from "vitest";
import { NOT_MEMBER_MESSAGE } from "@shared/errors";
import {
  ACCESS_LOST_NOTICE,
  ACCESS_LOST_TEXT,
  isNotMemberError,
  isReadDenied,
  loginNotice,
  shouldRedirectToLogin,
} from "./accessLoss";

describe("isReadDenied", () => {
  it("erkennt den Firestore-Code permission-denied", () => {
    expect(isReadDenied({ code: "permission-denied" })).toBe(true);
    expect(isReadDenied({ code: "unavailable" })).toBe(false);
    expect(isReadDenied(null)).toBe(false);
  });
});

describe("isNotMemberError", () => {
  it("nur die Function-Ablehnung „Not a member“, nicht „Wrong password“", () => {
    expect(isNotMemberError({ code: "functions/permission-denied", message: NOT_MEMBER_MESSAGE })).toBe(true);
    expect(isNotMemberError({ code: "functions/permission-denied", message: "Wrong password" })).toBe(false);
    expect(isNotMemberError({ code: "functions/internal", message: NOT_MEMBER_MESSAGE })).toBe(false);
  });
});

describe("shouldRedirectToLogin", () => {
  it("ohne Zugangsverlust nie", () => {
    expect(shouldRedirectToLogin(false, "/")).toBe(false);
  });

  it("aus der App heraus ja", () => {
    expect(shouldRedirectToLogin(true, "/")).toBe(true);
    expect(shouldRedirectToLogin(true, "/settings")).toBe(true);
  });

  it("nicht auf Login-, Magic-Link- und Gruppen-Link-Seiten", () => {
    for (const p of ["/login", "/login/new", "/m/abc", "/g/demo", "/g/demo/gift/x"]) {
      expect(shouldRedirectToLogin(true, p)).toBe(false);
    }
  });
});

describe("loginNotice", () => {
  it("liefert den Hinweis nur für den Zugangsverlust", () => {
    expect(loginNotice({ notice: ACCESS_LOST_NOTICE })).toBe(ACCESS_LOST_TEXT);
    expect(loginNotice({ from: { pathname: "/" } })).toBeNull();
    expect(loginNotice(null)).toBeNull();
  });
});
