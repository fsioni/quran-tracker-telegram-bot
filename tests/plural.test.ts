import { describe, expect, it } from "vitest";
import { arPlural } from "../src/locales/plural";

describe("arPlural", () => {
  const forms = {
    zero: "zero",
    one: "one",
    two: "two",
    few: "few",
    many: "many",
    other: "other",
  };

  it("returns zero form for 0", () => {
    expect(arPlural(0, forms)).toBe("zero");
  });

  it("returns one form for 1", () => {
    expect(arPlural(1, forms)).toBe("one");
  });

  it("returns two form for 2", () => {
    expect(arPlural(2, forms)).toBe("two");
  });

  it("returns few form for 3-10", () => {
    expect(arPlural(3, forms)).toBe("few");
    expect(arPlural(5, forms)).toBe("few");
    expect(arPlural(10, forms)).toBe("few");
  });

  it("returns many form for 11-99", () => {
    expect(arPlural(11, forms)).toBe("many");
    expect(arPlural(20, forms)).toBe("many");
    expect(arPlural(99, forms)).toBe("many");
  });

  it("returns other form for 100", () => {
    expect(arPlural(100, forms)).toBe("other");
  });

  it("returns few form for 103-110", () => {
    expect(arPlural(103, forms)).toBe("few");
    expect(arPlural(110, forms)).toBe("few");
  });

  it("returns many form for 111-199", () => {
    expect(arPlural(111, forms)).toBe("many");
  });

  it("falls back to other when optional forms are missing", () => {
    const minimal = { one: "one", other: "other" };
    expect(arPlural(0, minimal)).toBe("other");
    expect(arPlural(2, minimal)).toBe("other");
    expect(arPlural(5, minimal)).toBe("other");
    expect(arPlural(11, minimal)).toBe("other");
  });
});
