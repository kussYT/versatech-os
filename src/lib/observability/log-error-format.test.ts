import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatServerError } from "./log-error-format";

describe("formatServerError", () => {
  test("keeps the error name and drops the message", () => {
    const formatted = formatServerError(
      new Error("postgresql://versatech:secret@localhost:5432/versatech_os"),
    );
    assert.equal(formatted, "Error");
    assert.equal(formatted.includes("postgresql://"), false);
    assert.equal(formatted.includes("secret"), false);
  });

  test("includes a Prisma-like code without the raw object", () => {
    const error = Object.assign(new Error("Timed out fetching a new connection from the connection pool"), {
      name: "PrismaClientKnownRequestError",
      code: "P2024",
    });
    assert.equal(formatServerError(error), "PrismaClientKnownRequestError code=P2024");
    assert.equal(formatServerError(error).includes("connection pool"), false);
  });
});
