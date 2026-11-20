import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"

test("declarations match observed live response shapes", () => {
  const result = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--target", "ES2022", "tests/live-shapes.ts"], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})
