import { describe, expect, it } from "vitest";
import { toUpdate } from "./patch";

const DEL = { del: true };

describe("toUpdate", () => {
  it("macht aus undefined den Lösch-Marker, andere Werte bleiben", () => {
    expect(toUpdate({ title: "Buch", url: undefined, price: 0, note: "" }, () => DEL)).toEqual({
      title: "Buch",
      url: DEL,
      price: 0,
      note: "",
    });
  });

  it("null und false bleiben Werte (kein Löschen)", () => {
    expect(toUpdate({ paidBy: null, favorite: false }, () => DEL)).toEqual({ paidBy: null, favorite: false });
  });

  it("leerer Patch bleibt leer", () => {
    expect(toUpdate({}, () => DEL)).toEqual({});
  });
});
