import { describe, expect, it } from "vitest";
import {
  generateCode,
  hashCode,
  signSessionId,
  verifySessionId,
} from "../../src/mcp/auth/session";

const SECRET = "test-secret-32-bytes-base64url-x";
const SIX_DIGIT_RE = /^\d{6}$/;

describe("generateCode", () => {
  it("returns a 6-digit string", () => {
    const code = generateCode();
    expect(code).toMatch(SIX_DIGIT_RE);
  });
});

describe("hashCode", () => {
  it("is deterministic with same secret", async () => {
    const a = await hashCode("123456", SECRET);
    const b = await hashCode("123456", SECRET);
    expect(a).toBe(b);
  });

  it("differs from clear-text", async () => {
    const a = await hashCode("123456", SECRET);
    expect(a).not.toBe("123456");
  });
});

describe("signSessionId / verifySessionId", () => {
  it("round-trips", async () => {
    const signed = await signSessionId("abc123", SECRET);
    const verified = await verifySessionId(signed, SECRET);
    expect(verified).toBe("abc123");
  });

  it("returns null on tampered signature", async () => {
    const signed = await signSessionId("abc123", SECRET);
    const tampered = `${signed}x`;
    expect(await verifySessionId(tampered, SECRET)).toBeNull();
  });
});
