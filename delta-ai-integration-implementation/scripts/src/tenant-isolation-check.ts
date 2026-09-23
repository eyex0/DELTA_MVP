import assert from "node:assert/strict";
import { buildScopedProjectSet } from "@workspace/db/scoping";

const allowed = buildScopedProjectSet(["project-a", "project-b"], ["project-b", "project-c"]);
assert.deepEqual([...allowed].sort(), ["project-a", "project-b", "project-c"]);
assert.ok(allowed.has("project-a"));
assert.ok(!allowed.has("project-z"));

console.log("tenant isolation checks passed");
