import assert from "node:assert/strict";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const password = "Sup3rSecret!";
const hash = await bcrypt.hash(password, 12);
const matches = await bcrypt.compare(password, hash);

assert.equal(matches, true);

const token = jwt.sign({ userId: "user-123" }, "delta-dev-secret", { expiresIn: "7d" });
const payload = jwt.verify(token, "delta-dev-secret") as { userId: string };
assert.equal(payload.userId, "user-123");

console.log("auth checks passed");
