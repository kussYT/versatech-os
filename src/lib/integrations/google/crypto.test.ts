import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("google token crypto", () => {
  it("round-trips a secret with AUTH_SECRET", async () => {
    process.env.AUTH_SECRET =
      process.env.AUTH_SECRET?.trim() ||
      "test-auth-secret-at-least-32-characters!!";

    const { encryptSecret, decryptSecret } = await import(
      "@/lib/integrations/google/crypto"
    );

    const plaintext = "ya29.a0AfH6SMB-test-token";
    const enc = encryptSecret(plaintext);
    assert.notEqual(enc, plaintext);
    assert.match(enc, /^v1\./);
    assert.equal(decryptSecret(enc), plaintext);
  });
});
