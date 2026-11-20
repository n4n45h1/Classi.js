import assert from "node:assert/strict"
import test from "node:test"
import { ClassiClient, ClassiError } from "../dist/index.js"

test("karte.testResults selects complete results via tests with the same filters", async t => {
  const client = new ClassiClient()
  const regular = { id: "42", kind: 1, name: "Synthetic", detail: { labels: [], io_results: { scores: [{ score: 75 }] } } }
  const benesse = { id: "benesse", kind: "bc", detail: { bc_results: { exam: { id: "exam" } } } }
  for (const [id, classroom, expected] of [[42, undefined, regular], ["42", 0, regular], ["benesse", "class&room", benesse], ["missing", undefined, undefined]]) {
    let calls = 0
    t.mock.method(globalThis, "fetch", async (url, opts) => {
      calls++
      const filter = classroom === undefined ? "" : `&classroom_id=${encodeURIComponent(String(classroom))}`
      assert.equal(String(url), `https://karte.classi.jp/api/users/user%2Fa/tests?kind=1${filter}`)
      assert.equal(opts.method, "GET")
      return new Response(JSON.stringify([benesse, regular]))
    })
    assert.deepEqual(await client.karte.testResults("user/a", id, 1, classroom), expected)
    assert.equal(calls, 1)
    t.mock.restoreAll()
  }
})

test("karte.testResults returns undefined for an empty list", async t => {
  t.mock.method(globalThis, "fetch", async () => new Response("[]"))
  assert.equal(await new ClassiClient().karte.testResults(1, "missing", 1), undefined)
})

test("karte.testResults propagates HTTP and network errors", async t => {
  const client = new ClassiClient()
  t.mock.method(globalThis, "fetch", async () => new Response('{"error":true}', { status: 500 }))
  await assert.rejects(client.karte.testResults(1, "42", 1), e => e instanceof ClassiError && e.status === 500 && e.body.error === true)
  t.mock.restoreAll()
  const error = new Error("network unavailable")
  t.mock.method(globalThis, "fetch", async () => { throw error })
  await assert.rejects(client.karte.testResults(1, "42", 1), e => e === error)
})
