import { describe, expect, it, vi } from "vitest";
import type { Person } from "@/lib/types";
import { participationCount } from "./ParticipationSheet";

// storage.ts initialisiert beim Import Firebase; ohne echte Keys (.env.local) wirft das.
vi.mock("@/lib/storage", () => ({ setDefaultParticipation: vi.fn() }));

const person = (id: string, defaultParticipantIds?: string[]): Person =>
  ({ id, name: id, birthday: "01-01", color: "#000000", createdAt: 0, defaultParticipantIds }) as Person;

describe("participationCount", () => {
  it("zählt die Personen, bei denen ich standardmäßig mitmache – ohne mich selbst", () => {
    const persons = [person("me", ["me"]), person("anna", ["me", "ben"]), person("ben", ["anna"]), person("lea")];
    expect(participationCount(persons, "me")).toEqual({ active: 1, total: 3 });
  });

  it("liefert 0 von 0, wenn es nur mich gibt", () => {
    expect(participationCount([person("me")], "me")).toEqual({ active: 0, total: 0 });
  });
});
