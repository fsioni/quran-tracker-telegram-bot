import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("schema markdown", () => {
  it("matches snapshot of generated content", () => {
    const md = readFileSync(
      join(__dirname, "..", "..", "src", "mcp", "resources", "schema.md"),
      "utf-8"
    );
    expect(md).toMatchSnapshot();
  });
});
