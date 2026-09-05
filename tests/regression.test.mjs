import assert from "node:assert/strict"
import test from "node:test"
import { CookieJar, ClassiClient, ClassiError } from "../dist/index.js"
import { Http } from "../dist/http.js"

const url = (path = "/") => new URL(`https://training.classi.jp${path}`)
const json = (data, status = 200) => new Response(JSON.stringify(data), { status })

function mockFetch(t, handler) {
  t.mock.method(globalThis, "fetch", handler)
}

test("cookies: path boundaries and longest-path-first ordering", () => {
  const jar = new CookieJar()
  jar.setFromResponse(["sid=root; Path=/", "sid=app; Path=/app"], url())
  assert.equal(jar.getHeader(url("/application")), "sid=root")
  assert.equal(jar.getHeader(url("/app")), "sid=app; sid=root")
  assert.equal(jar.getHeader(url("/app/page")), "sid=app; sid=root")
})

test("cookies: default path and invalid Path fallback", () => {
  const jar = new CookieJar()
  jar.setFromResponse(["a=1", "b=2; Path=invalid"], url("/app/login"))
  assert.equal(jar.getHeader(url("/")), undefined)
  assert.equal(jar.getHeader(url("/app/page")), "a=1; b=2")
})

test("cookies: Max-Age overrides Expires in either order", () => {
  for (const attrs of [
    "Max-Age=0; Expires=Wed, 01 Jan 2098 00:00:00 GMT",
    "Expires=Wed, 01 Jan 2098 00:00:00 GMT; Max-Age=0",
  ]) {
    const jar = new CookieJar()
    jar.setFromResponse(["sid=old; Path=/", `sid=new; Path=/; ${attrs}`], url())
    assert.equal(jar.getHeader(url()), undefined)
  }
  const jar = new CookieJar()
  jar.setFromResponse(["sid=1; Max-Age=3600; Expires=Thu, 01 Jan 1970 00:00:00 GMT"], url())
  assert.equal(jar.getHeader(url()), "sid=1")
})

test("cookies: Secure flag, host-only scope, and unrelated Domain", () => {
  const jar = new CookieJar()
  jar.setFromResponse(["plain=1", "secure=2; Secure", "shared=3; Domain=.classi.jp", "bad=4; Domain=example.org"], url())
  assert.equal(jar.getHeader(new URL("http://training.classi.jp/")), "plain=1; shared=3")
  assert.equal(jar.getHeader(new URL("https://study.classi.jp/")), "shared=3")
  assert.equal(jar.getHeader(new URL("https://example.org/")), undefined)
})

test("cookies: reject invalid prefixed cookies rather than repairing them", () => {
  const jar = new CookieJar()
  jar.setFromResponse([
    "__Host-a=1; Secure; Domain=classi.jp; Path=/",
    "__Host-b=1; Secure; Path=/app",
    "__Host-c=1; Path=/",
    "__Host-d=1; Secure",
    "__Secure-a=1",
    "__Host-valid=1; Secure; Path=/",
  ], url())
  assert.equal(jar.getHeader(url()), "__Host-valid=1")
})

test("cookies: restored sessions do not alias caller-owned arrays or cookies", () => {
  const source = new CookieJar()
  source.setFromResponse(["sid=original; Path=/"], url())
  const data = source.toJSON()
  const restored = CookieJar.fromJSON(data)
  data[0].value = "mutated"
  data.push({ ...data[0], name: "extra" })
  assert.equal(restored.getHeader(url()), "sid=original")
})

test("http: parses JSON whitespace and primitive responses, preserves non-JSON", async (t) => {
  for (const [body, expected] of [[" \n {\"ok\":true}", { ok: true }], ["false", false], ["null", null], ["<html>login</html>", "<html>login</html>"]]) {
    mockFetch(t, async () => new Response(body))
    assert.deepEqual((await new Http().request("GET", url().href)).data, expected)
    t.mock.restoreAll()
  }
})

test("http: legacy Headers without getSetCookie retain multiple cookies and Expires commas", async (t) => {
  const headers = new Headers({ "set-cookie": "a=1; Expires=Wed, 01 Jan 2098 00:00:00 GMT; Path=/, b=2; Path=/" })
  Object.defineProperty(headers, "getSetCookie", { value: undefined })
  mockFetch(t, async () => ({ status: 200, headers, text: async () => "{}" }))
  const http = new Http()
  await http.request("GET", url().href)
  assert.equal(http.jar.getHeader(url()), "a=1; b=2")
})

test("API wrappers reject redirects with the original status and body", async (t) => {
  mockFetch(t, async () => new Response("redirect", { status: 302 }))
  const c = new ClassiClient()
  for (const call of [() => c.training.currentUser(), () => c.study.currentUser(), () => c.platform.userInfo(), () => c.portfolio.userInfo(), () => c.karte.tests(1, 1)]) {
    await assert.rejects(call, (e) => e instanceof ClassiError && e.status === 302 && e.body === "redirect")
  }
})

test("query parameters preserve timezone plus signs and reserved characters", async (t) => {
  const requests = []
  mockFetch(t, async (target) => { requests.push(new URL(target)); return json({}) })
  const c = new ClassiClient()
  const date = "2026-09-05T00:00:00+09:00"
  await c.platform.calendarEvents(date, date)
  assert.equal(requests.at(-1).searchParams.get("start_at"), date)
  assert.equal(requests.at(-1).searchParams.get("end_at"), date)
  await c.platform.removeBookmark("a&other=1#fragment")
  assert.equal(requests.at(-1).searchParams.get("message_id"), "a&other=1#fragment")
  assert.equal(requests.at(-1).searchParams.has("other"), false)
  await c.study.dailyReport("date&other=1")
  assert.equal(requests.at(-1).searchParams.get("date"), "date&other=1")
  await c.karte.tests("a/b?x=1", 1)
  assert.equal(requests.at(-1).pathname, "/api/users/a%2Fb%3Fx%3D1/tests")
})

test("training: refreshes CSRF and retries a 422 write exactly once", async (t) => {
  const calls = []
  mockFetch(t, async (target, opts) => {
    calls.push([target.pathname, opts.headers["X-CSRF-Token"]])
    if (target.pathname.endsWith("csrf_token")) return json({ token: "fresh" })
    return opts.headers["X-CSRF-Token"] === "stale" ? json({ error: "csrf" }, 422) : json({ answerId: 7 })
  })
  const c = ClassiClient.fromSession({ cookies: [], csrfTokens: { training: "stale" } })
  assert.deepEqual(await c.training.submitAnswers(1, { id: 1, question_section_id: 1, questions: [] }), { answerId: 7 })
  assert.equal(calls.length, 3)
  assert.equal(calls[0][1], "stale")
  assert.equal(calls[2][1], "fresh")
})

test("training: a second 422 is surfaced, not retried forever", async (t) => {
  let count = 0
  mockFetch(t, async (target) => { count++; return target.pathname.endsWith("csrf_token") ? json({ token: "fresh" }) : json({ error: "invalid" }, 422) })
  const c = ClassiClient.fromSession({ cookies: [], csrfTokens: { training: "stale" } })
  await assert.rejects(() => c.training.submitAnswers(1, { id: 1, question_section_id: 1, questions: [] }), (e) => e.status === 422)
  assert.equal(count, 3)
})

test("training: GET and unauthorized writes preserve errors without CSRF refetch", async (t) => {
  let count = 0
  mockFetch(t, async () => { count++; return json({ error: "unauthorized" }, 401) })
  const c = ClassiClient.fromSession({ cookies: [], csrfTokens: { training: "token" } })
  await assert.rejects(() => c.training.currentUser(), (e) => e.status === 401)
  await assert.rejects(() => c.training.submitAnswers(1, { id: 1, question_section_id: 1, questions: [] }), (e) => e.status === 401)
  assert.equal(count, 2)
})

test("CSRF failures preserve HTTP status in both authentication and training", async (t) => {
  mockFetch(t, async () => json({ error: "unavailable" }, 503))
  const c = new ClassiClient()
  for (const call of [() => c.id.loginMethods("test"), () => c.training.submitAnswers(1, { id: 1, question_section_id: 1, questions: [] })]) {
    await assert.rejects(call, (e) => e instanceof ClassiError && e.status === 503 && e.endpoint.endsWith("csrf_token"))
  }
})

test("login stops when continuation fails", async (t) => {
  let token = 0
  let issued = false
  mockFetch(t, async (target, opts) => {
    if (target.pathname.endsWith("csrf_token")) return json({ success: true, data: String(++token) })
    if (target.pathname.endsWith("login_methods")) return json({ success: true, data: [{ name: "password", recaptcha: false }] })
    if (target.pathname.endsWith("with_password")) {
      return json({ success: true })
    }
    if (target.pathname.endsWith("continue")) return json({ success: false }, 503)
    if (target.pathname.endsWith("issue_cookie")) issued = true
    return json({})
  })
  await assert.rejects(() => new ClassiClient({ username: "test", password: "test" }).login(), (e) => e.status === 503 && e.endpoint.endsWith("continue"))
  assert.equal(issued, false)
})


test("login success uses the latest CSRF token and returns continuation status", async (t) => {
  let token = 0
  let issued = false
  const status = {
    account_select_required: false, profile_confirmation_required: false,
    password_change_required: false, tos_required: false,
    email_registration_guide_required: false, benesse_account_invitation_code_required: false,
  }
  mockFetch(t, async (target, opts) => {
    if (target.pathname.endsWith("csrf_token")) return json({ success: true, data: String(++token) })
    if (target.pathname.endsWith("login_methods")) return json({ success: true, data: [{ name: "password", recaptcha: false }] })
    if (target.pathname.endsWith("with_password")) {
      assert.equal(opts.headers["X-CSRF-Token"], String(token))
      return json({ success: true })
    }
    if (target.pathname.endsWith("continue")) return json({ success: true, data: status })
    if (target.pathname.endsWith("issue_cookie")) { issued = true; return json({ success: true }) }
    return json({})
  })
  assert.deepEqual(await new ClassiClient({ username: "test", password: "test" }).login(), { status })
  assert.equal(issued, true)
})
