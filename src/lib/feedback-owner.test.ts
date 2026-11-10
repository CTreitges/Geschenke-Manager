import type { User } from "firebase/auth";
import { describe, expect, it } from "vitest";
import { FEEDBACK_OWNER_UID, isFeedbackOwner } from "./feedback-owner";

const user = (uid: string, email?: string) => ({ uid, email }) as unknown as User;

describe("isFeedbackOwner", () => {
  it("erkennt den Owner an der UID", () => {
    expect(isFeedbackOwner(user(FEEDBACK_OWNER_UID))).toBe(true);
  });

  it("andere UID ist kein Owner, auch mit gesetzter Mail", () => {
    expect(isFeedbackOwner(user("andere-uid", "owner@example.com"))).toBe(false);
  });

  it("ohne Anmeldung kein Owner", () => {
    expect(isFeedbackOwner(null)).toBe(false);
  });
});
