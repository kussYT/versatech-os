import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  INSTAGRAM_INVALID_MESSAGE,
  LINKEDIN_INVALID_MESSAGE,
  instagramProfileUrl,
  normalizeInstagramHandle,
  normalizeLinkedinUrl,
} from "./social";

describe("normalizeInstagramHandle", () => {
  it("stores a bare lowercase handle from @, bare or URL input", () => {
    for (const raw of [
      "@maro.crea",
      "maro.crea",
      " Maro.Crea ",
      "https://instagram.com/maro.crea/",
      "https://www.instagram.com/maro.crea",
      "instagram.com/maro.crea?igsh=abc",
      "http://m.instagram.com/@maro.crea/",
    ]) {
      assert.deepEqual(normalizeInstagramHandle(raw), { ok: true, value: "maro.crea" }, raw);
    }
  });

  it("blank input is null, not an error", () => {
    assert.deepEqual(normalizeInstagramHandle(""), { ok: true, value: null });
    assert.deepEqual(normalizeInstagramHandle("   "), { ok: true, value: null });
    assert.deepEqual(normalizeInstagramHandle(null), { ok: true, value: null });
    assert.deepEqual(normalizeInstagramHandle(undefined), { ok: true, value: null });
  });

  it("rejects invalid handles and non-profile URLs", () => {
    for (const raw of [
      "maro crea",
      "maro-crea",
      "@",
      ".maro",
      "maro.",
      "ma..ro",
      "a".repeat(31),
      "https://instagram.com/p/abc123/",
      "https://evil.example/maro.crea",
      "javascript:alert(1)",
    ]) {
      assert.deepEqual(
        normalizeInstagramHandle(raw),
        { ok: false, message: INSTAGRAM_INVALID_MESSAGE },
        raw,
      );
    }
  });

  it("builds the profile URL", () => {
    assert.equal(instagramProfileUrl("maro.crea"), "https://www.instagram.com/maro.crea/");
    assert.equal(instagramProfileUrl(null), null);
    assert.equal(instagramProfileUrl("bad handle"), null);
  });
});

describe("normalizeLinkedinUrl", () => {
  it("keeps https linkedin.com URLs, adds scheme, drops query and trailing slash", () => {
    assert.deepEqual(normalizeLinkedinUrl("linkedin.com/company/maro-crea/"), {
      ok: true,
      value: "https://linkedin.com/company/maro-crea",
    });
    assert.deepEqual(
      normalizeLinkedinUrl("https://www.linkedin.com/in/maro-crea/?utm_source=share"),
      { ok: true, value: "https://www.linkedin.com/in/maro-crea" },
    );
    assert.deepEqual(normalizeLinkedinUrl("http://fr.linkedin.com/in/maro"), {
      ok: true,
      value: "https://fr.linkedin.com/in/maro",
    });
  });

  it("blank input is null", () => {
    assert.deepEqual(normalizeLinkedinUrl(""), { ok: true, value: null });
    assert.deepEqual(normalizeLinkedinUrl(null), { ok: true, value: null });
  });

  it("rejects other hosts, schemes, credentials and bare host", () => {
    for (const raw of [
      "https://evil.example/in/maro",
      "https://linkedin.com.evil.example/in/maro",
      "https://notlinkedin.com/in/maro",
      "javascript:alert(1)",
      "ftp://linkedin.com/in/maro",
      "https://user:pass@linkedin.com/in/maro",
      "https://linkedin.com:8443/in/maro",
      "https://www.linkedin.com/",
      "maro crea",
    ]) {
      assert.deepEqual(
        normalizeLinkedinUrl(raw),
        { ok: false, message: LINKEDIN_INVALID_MESSAGE },
        raw,
      );
    }
  });
});
