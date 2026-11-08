import assert from "node:assert/strict"
import test from "node:test"
import { ClassiClient, ClassiError, ClassiNetworkError, ClassiTimeoutError, CookieJar } from "../dist/index.js"
import { Http } from "../dist/http.js"

const json = (data, status = 200) => new Response(JSON.stringify(data), { status })

function client(fetcher, credentials = false, opts = {}) {
  const fetch = (url, init) => {
    const path = url.pathname
    if (credentials) {
      if (path.endsWith("/csrf_token") && url.hostname === "id-api.classi.jp")
        return Promise.resolve(json({ success: true, data: "csrf" }))
      if (path.endsWith("/login_methods"))
        return Promise.resolve(json({ success: true, data: [{ name: "password", recaptcha: false }] }))
      if (path.endsWith("/login/continue"))
        return Promise.resolve(json({ success: true, data: {
          account_select_required: false, profile_confirmation_required: false,
          password_change_required: false, tos_required: false,
          email_registration_guide_required: false,
          benesse_account_invitation_code_required: false,
        } }))
      if (path.endsWith("/login/issue_cookie")) return Promise.resolve(json({ success: true }))
      if (url.hostname === "id.classi.jp") return Promise.resolve(json({}))
    }
    return fetcher(url, init)
  }
  return new ClassiClient({ ...(credentials ? { username: "u", password: "p" } : {}), fetch, ...opts })
}

test("cookies reject public-suffix domains but accept classi.jp", () => {
  const jar = new CookieJar()
  jar.setFromResponse(["bad=1; Domain=jp; Path=/", "good=2; Domain=classi.jp; Path=/"],
    new URL("https://training.classi.jp/"))
  assert.equal(jar.getHeader(new URL("https://id.classi.jp/")), "good=2")
})

test("session import validates shape and clearSession clears CSRF", () => {
  assert.throws(() => ClassiClient.fromSession({ cookies: "bad", csrfTokens: {} }), TypeError)
  assert.throws(() => ClassiClient.fromSession({ cookies: [{ domain: "jp" }], csrfTokens: {} }), TypeError)
  const c = ClassiClient.fromSession({ cookies: [], csrfTokens: { training: "stale" } })
  c.clearSession()
  assert.deepEqual(c.session, { cookies: [], csrfTokens: {} })
})

test("timeout and network errors have distinct classes", async () => {
  const network = new Http({ fetch: async () => { throw new TypeError("offline") } })
  await assert.rejects(() => network.request("GET", "https://platform.classi.jp/api/user/info"),
    (e) => e instanceof ClassiNetworkError && e.status === 0 && e.cause.message === "offline")
  const hung = new Http({ timeoutMs: 10, fetch: async (_url, opts) =>
    new Promise((_r, reject) => opts.signal.addEventListener("abort",
      () => reject(Object.assign(new Error("aborted"), { name: "AbortError" })))) })
  await assert.rejects(() => hung.request("GET", "https://platform.classi.jp/api/user/info"),
    (e) => e instanceof ClassiTimeoutError)
})

test("concurrent expired GETs reauthenticate only once", async () => {
  let authenticated = false
  let logins = 0
  const c = client(async (url) => {
    if (url.pathname.endsWith("/login/with_password")) {
      logins++
      authenticated = true
      return json({ success: true })
    }
    if (!authenticated) return json({ error: "expired" }, 401)
    return json({ userFullName: "Test", userId: "1", schoolId: "2" })
  }, true)
  const results = await Promise.all([c.training.currentUser(), c.training.currentUser()])
  assert.equal(logins, 1)
  assert.equal(results[0].userFullName, "Test")
})

test("authentication failure on a POST never triggers replay", async () => {
  let writes = 0, logins = 0
  const c = client(async (url, opts) => {
    if (url.pathname.endsWith("/login/with_password")) { logins++; return json({ success: true }) }
    if (url.pathname.endsWith("/csrf_token")) return json({ token: "csrf" })
    if (opts.method === "POST") { writes++; return json({ error: "expired" }, 401) }
    return json({})
  }, true)
  await assert.rejects(() => c.training.submitAnswers(1, {
    id: 1, question_section_id: 1, questions: [],
  }), (e) => e instanceof ClassiError && e.status === 401)
  assert.equal(writes, 1)
  assert.equal(logins, 0)
})

test("non-CSRF 422 never retries a submission", async () => {
  let writes = 0
  const c = client(async (url, opts) => {
    if (url.pathname.endsWith("/csrf_token")) return json({ token: "csrf" })
    if (opts.method === "POST") { writes++; return json({ error: "invalid answer" }, 422) }
    return json({})
  })
  await assert.rejects(() => c.training.submitAnswers(1, {
    id: 1, question_section_id: 1, questions: [],
  }), (e) => e.status === 422)
  assert.equal(writes, 1)
})

test("explicit CSRF error refreshes token exactly once", async () => {
  let writes = 0, tokens = 0
  const c = client(async (url, opts) => {
    if (url.pathname.endsWith("/csrf_token")) return json({ token: "t" + ++tokens })
    if (opts.method === "POST") {
      writes++
      return writes === 1 ? json({ error: "CSRF expired" }, 422) : json({ answerId: 17 })
    }
    return json({})
  })
  assert.deepEqual(await c.training.submitAnswers(1, {
    id: 1, question_section_id: 1, questions: [],
  }), { answerId: 17 })
  assert.equal(writes, 2)
  assert.equal(tokens, 2)
})

test("scoped GET rejects unsafe paths without making HTTP requests", async () => {
  let calls = 0
  const c = client(async (url) => { calls++; return json({ location: url.href }) })
  const answer = await c.get("training", "/current_user", { date: "2026-11-08T10:00+09:00" })
  assert.match(answer.location, /date=2026-11-08T10%3A00%2B09%3A00/)
  await assert.rejects(() => c.get("training", "/../../api/v1/users"), TypeError)
  await assert.rejects(() => c.get("training", "//example.org"), TypeError)
  await assert.rejects(() => c.get("invalid", "/api"), TypeError)
  assert.equal(calls, 1)
})

test("allNotifications enforces a maximum across pages", async () => {
  const offsets = []
  const c = client(async (url) => {
    const offset = Number(url.searchParams.get("offset"))
    const limit = Number(url.searchParams.get("limit"))
    offsets.push(offset)
    return json({ count: 8,
      items: Array.from({ length: Math.min(limit, 8 - offset) }, (_, i) => ({ id: i + offset + 1 })) })
  })
  const all = await c.platform.allNotifications("school", { pageSize: 2, maxItems: 5 })
  assert.deepEqual(all.map((x) => x.id), [1, 2, 3, 4, 5])
  assert.deepEqual(offsets, [0, 2, 4])
})

test("invalid calendar month is rejected before requesting data", () => {
  let calls = 0
  const c = client(async () => { calls++; return json([]) })
  assert.throws(() => c.training.studentTasks(2026, 13), RangeError)
  assert.throws(() => c.training.activitySummary(2026, 0), RangeError)
  assert.equal(calls, 0)
})
