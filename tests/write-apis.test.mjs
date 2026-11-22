import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import test from "node:test"
import { ClassiClient, ClassiError } from "../dist/index.js"
import { Http } from "../dist/http.js"

const PLAT = "https://platform.classi.jp"
const TRAINING = "https://training-api.classi.jp/api"
const json = (data, status = 200, headers = {}) => new Response(JSON.stringify(data), { status, headers })
const xsrfCookie = (overrides = {}) => ({
  name: "XSRF-TOKEN", value: "cookie%2Ftoken%3D", domain: "platform.classi.jp",
  path: "/", hostOnly: true, secure: true, ...overrides,
})
const client = (csrfTokens = {}, cookies = [xsrfCookie()]) => ClassiClient.fromSession({ csrfTokens, cookies })

function mockFetch(t, handler = () => json({ ok: true })) {
  const calls = []
  t.mock.method(globalThis, "fetch", async (target, opts) => {
    const call = { url: target.href, method: opts.method, headers: new Headers(opts.headers), body: opts.body }
    calls.push(call)
    return handler(call, calls.length)
  })
  return calls
}

const groupAttachment = {
  entry_cd: "attachment", file_type: 2, name: "note.pdf", download_uri: "/download/file",
  title: "Title", description: "Description", url: "https://example.invalid/file",
}
const mappedGroupAttachment = {
  entry_cd: "attachment", type: 2, file_type: 2, download_url: "/download/file", file_name: "note.pdf",
  title: "Title", description: "Description", url: "https://example.invalid/file",
}
const talkroomAttachment = { entry_cd: "attachment", type: 2, file_name: "note.pdf", download_url: "/download/file" }

const platformCases = [
  {
    name: "sendGroupMessage", path: "/api/v2/groups/group%2F1/messages", token: true, xhr: true,
    contentType: "application/x-www-form-urlencoded",
    invoke: (api) => api.sendGroupMessage("group/1", "Hello & こんにちは", [groupAttachment], 31),
    body: { message: "Hello & こんにちは", attach: [mappedGroupAttachment], reserved_id: 31 },
    empty: (api) => api.sendGroupMessage(1, ""),
    emptyBody: { message: "", attach: [] },
  },
  {
    name: "commentOnGroupMessage", path: "/api/v2/groups/1/messages/message%2F2/comments", xhr: true,
    contentType: "application/x-www-form-urlencoded",
    invoke: (api) => api.commentOnGroupMessage(1, "message/2", "Reply & +", [
      { entry_cd: 3, file_type: 1, file_name: "fallback.png", download_url: "/fallback" },
    ]),
    body: { message: "Reply & +", attach: [{ entry_cd: 3, type: 1, file_type: 1, download_url: "/fallback", file_name: "fallback.png" }] },
    empty: (api) => api.commentOnGroupMessage(1, 2, ""),
    emptyBody: { message: "", attach: [] },
  },
  {
    name: "sendTalkroomMessage", path: "/api/talkroom/room%2F1/send", token: true, xhr: true, noXsrf: true,
    contentType: "application/json",
    invoke: (api) => api.sendTalkroomMessage("room/1", "Reply", [talkroomAttachment]),
    body: { message: "Reply", attached: [talkroomAttachment] },
    empty: (api) => api.sendTalkroomMessage(1, ""),
    emptyBody: { message: "", attached: [] },
  },
  {
    name: "markGroupMessageRead", path: "/api/v3/group_messages/message%2F2/mark_as_read", xhr: true,
    invoke: (api) => api.markGroupMessageRead("message/2"),
  },
  {
    name: "markTalkroomMessageRead", path: "/api/talkroom/room%2F1/message%2F2/read", method: "GET",
    invoke: (api) => api.markTalkroomMessageRead("room/1", "message/2"),
  },
  {
    name: "markAllServiceNotificationsRead", path: "/communication/api/v1/notification/service/allread",
    contentType: "application/json", body: [], invoke: (api) => api.markAllServiceNotificationsRead(),
  },
]

for (const entry of platformCases) {
  test(`platform.${entry.name}: exact method, encoding and frontend CSRF headers`, async (t) => {
    const calls = mockFetch(t, ({ url }) => url.endsWith("/csrf/token") ? json({ token: "custom" }) : json({ ok: true }))
    assert.deepEqual(await entry.invoke(client().platform), { ok: true })
    assert.equal(calls.length, entry.token ? 2 : 1)
    if (entry.token) {
      assert.equal(calls[0].url, `${PLAT}/api/v2/csrf/token`)
      assert.equal(calls[0].method, "GET")
      assert.equal(calls[0].body, undefined)
      assert.equal(calls[0].headers.get("X-XSRF-TOKEN"), "cookie/token=")
    }
    const call = calls.at(-1)
    assert.equal(call.url, PLAT + entry.path)
    assert.equal(call.method, entry.method ?? "POST")
    assert.equal(call.headers.get("Content-Type"), entry.contentType ?? null)
    assert.equal(call.body, entry.body === undefined ? undefined : JSON.stringify(entry.body))
    assert.equal(call.headers.get("X-CSRF-TOKEN"), entry.token ? "custom" : null)
    assert.equal(call.headers.get("X-XSRF-TOKEN"), entry.noXsrf ? null : "cookie/token=")
    assert.equal(call.headers.get("X-Requested-With"), entry.xhr ? "XMLHttpRequest" : null)
    assert.equal(call.headers.get("Origin"), PLAT)
    assert.equal(call.headers.get("Referer"), PLAT + "/")
  })

  if (entry.empty) test(`platform.${entry.name}: empty message and default empty attachments`, async (t) => {
    const calls = mockFetch(t, () => new Response(null, { status: 204 }))
    await entry.empty(client({ platform: "cached" }).platform)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].body, JSON.stringify(entry.emptyBody))
  })

  test(`platform.${entry.name}: propagates a non-CSRF failure without replay`, async (t) => {
    const calls = mockFetch(t, () => json({ error: "denied" }, 500))
    await assert.rejects(() => entry.invoke(client({ platform: "cached" }).platform), (error) => {
      assert.ok(error instanceof ClassiError)
      assert.equal(error.status, 500)
      assert.equal(error.endpoint, entry.path)
      assert.deepEqual(error.body, { error: "denied" })
      return true
    })
    assert.equal(calls.length, 1)
  })
}

test("platform.uploadAttachment: multipart file, automatic boundary, cookie CSRF only", async (t) => {
  const uploaded = { entry_cd: 7, file_type: 2, download_uri: "/download/7", name: "note.txt" }
  const calls = mockFetch(t, () => json(uploaded))
  assert.deepEqual(await client().platform.uploadAttachment(new Blob(["Hello"], { type: "text/plain" }), "note.txt"), uploaded)
  const call = calls[0]
  assert.equal(calls.length, 1)
  assert.equal(call.url, `${PLAT}/api/cbank/attach`)
  assert.equal(call.method, "POST")
  assert.equal(call.headers.get("Content-Type"), null)
  assert.equal(call.headers.get("X-Requested-With"), null)
  assert.equal(call.headers.get("X-CSRF-TOKEN"), null)
  assert.equal(call.headers.get("X-XSRF-TOKEN"), "cookie/token=")
  assert.ok(call.body instanceof FormData)
  assert.deepEqual([...call.body.keys()], ["file"])
  const file = call.body.get("file")
  assert.equal(file.name, "note.txt")
  assert.equal(file.type, "text/plain")
  assert.equal(await file.text(), "Hello")
  const request = new Request(call.url, { method: call.method, headers: call.headers, body: call.body })
  assert.match(request.headers.get("Content-Type"), /^multipart\/form-data; boundary=.+/)
  const wire = await request.text()
  assert.match(wire, /name="file"; filename="note.txt"/)
  assert.match(wire, /Content-Type: text\/plain\r\n\r\nHello\r\n/)
})

test("platform.uploadAttachment: empty Blob, optional filename and failure", async (t) => {
  let status = 200
  const calls = mockFetch(t, () => json({}, status))
  await client().platform.uploadAttachment(new Blob([]))
  assert.equal(calls[0].body.get("file").size, 0)
  assert.equal(calls[0].body.get("file").name, "blob")
  status = 413
  await assert.rejects(() => client().platform.uploadAttachment(new Blob([])), (error) =>
    error instanceof ClassiError && error.status === 413 && error.endpoint === "/api/cbank/attach")
  assert.equal(calls.length, 2)
})

test("platform: caches custom CSRF across group/talkroom writes and supports invalidation", async (t) => {
  const calls = mockFetch(t, ({ url }) => json(url.endsWith("/csrf/token") ? { token: "cached" } : {}))
  const c = client()
  await c.platform.sendGroupMessage(1, "one")
  await c.platform.sendTalkroomMessage(2, "two")
  assert.equal(calls.length, 3)
  assert.equal(calls[2].headers.get("X-CSRF-TOKEN"), "cached")
  assert.equal(c.session.csrfTokens.platform, "cached")
  c.platform.invalidateCsrf()
  await c.platform.sendGroupMessage(1, "three")
  assert.equal(calls.filter(({ url }) => url.endsWith("/csrf/token")).length, 2)
})

for (const [status, body] of [[422, { error: "expired" }], [403, { errors: ["CSRF token mismatch"] }], [403, "Invalid authenticity token"]]) {
  test(`platform: refreshes and replays once for ${status} ${JSON.stringify(body)}`, async (t) => {
    const calls = mockFetch(t, ({ url }, index) => {
      if (url.endsWith("/csrf/token")) return json({ token: "fresh" }, 200, { "Set-Cookie": "XSRF-TOKEN=new%2Fcookie; Path=/; Secure" })
      return index === 1 ? json(body, status) : json({ sent: true })
    })
    assert.deepEqual(await client({ platform: "stale" }).platform.sendGroupMessage(1, "one"), { sent: true })
    assert.equal(calls.length, 3)
    assert.equal(calls[0].headers.get("X-CSRF-TOKEN"), "stale")
    assert.equal(calls[1].url, `${PLAT}/api/v2/csrf/token`)
    assert.equal(calls[2].headers.get("X-CSRF-TOKEN"), "fresh")
    assert.equal(calls[2].headers.get("X-XSRF-TOKEN"), "new/cookie")
    assert.equal(calls[2].method, calls[0].method)
    assert.equal(calls[2].url, calls[0].url)
    assert.equal(calls[2].body, calls[0].body)
  })
}

test("platform: cookie-only comment refreshes CSRF cookies without adding custom token", async (t) => {
  const calls = mockFetch(t, ({ url }, index) => url.endsWith("/csrf/token")
    ? json({ token: "fresh" }, 200, { "Set-Cookie": "XSRF-TOKEN=updated; Path=/; Secure" })
    : json({}, index === 1 ? 422 : 200))
  await client().platform.commentOnGroupMessage(1, 2, "reply")
  assert.equal(calls.length, 3)
  assert.equal(calls[2].headers.get("X-CSRF-TOKEN"), null)
  assert.equal(calls[2].headers.get("X-XSRF-TOKEN"), "updated")
  assert.equal(calls[2].body, calls[0].body)
})

test("platform: second CSRF rejection is final", async (t) => {
  const calls = mockFetch(t, ({ url }) => url.endsWith("/csrf/token") ? json({ token: "fresh" }) : json({ error: "csrf" }, 422))
  await assert.rejects(() => client({ platform: "stale" }).platform.sendTalkroomMessage(1, "one"),
    (error) => error instanceof ClassiError && error.status === 422)
  assert.equal(calls.length, 3)
})

test("platform: Japanese posting restriction is preserved without a CSRF retry", async (t) => {
  const body = { message: "投稿が制限されています。" }
  const calls = mockFetch(t, () => json(body, 403))
  await assert.rejects(() => client({ platform: "cached" }).platform.sendGroupMessage(1, "one"), (error) => {
    assert.ok(error instanceof ClassiError)
    assert.equal(error.status, 403)
    assert.deepEqual(error.body, body)
    return true
  })
  assert.equal(calls.length, 1)
})

test("platform: permission 403 and network failures are never retried", async (t) => {
  let failNetwork = false
  const calls = mockFetch(t, () => {
    if (failNetwork) throw new TypeError("synthetic network failure")
    return json({ error: "permission denied" }, 403)
  })
  const c = client({ platform: "cached" })
  await assert.rejects(() => c.platform.sendGroupMessage(1, "one"), (error) => error.status === 403)
  failNetwork = true
  await assert.rejects(() => c.platform.sendGroupMessage(1, "two"), /synthetic network failure/)
  assert.equal(calls.length, 2)
})

for (const [status, data] of [[500, { error: "unavailable" }], [200, {}], [200, { token: "" }], [200, { token: 123 }], [200, null]]) {
  test(`platform: invalid CSRF response ${status} ${JSON.stringify(data)} aborts before send`, async (t) => {
    const calls = mockFetch(t, () => json(data, status))
    await assert.rejects(() => client().platform.sendGroupMessage(1, "one"), (error) =>
      error instanceof ClassiError && error.status === status && error.endpoint === `${PLAT}/api/v2/csrf/token`)
    assert.equal(calls.length, 1)
    assert.equal(calls[0].method, "GET")
  })
}

test("http: cookie-derived XSRF respects cookie scope and decoding", async (t) => {
  const calls = mockFetch(t)
  for (const [cookie, url, expected] of [
    [xsrfCookie(), `${PLAT}/api`, "cookie/token="],
    [xsrfCookie(), "https://study.classi.jp/api", null],
    [xsrfCookie({ path: "/private" }), `${PLAT}/api`, null],
    [xsrfCookie({ expires: 0 }), `${PLAT}/api`, null],
    [xsrfCookie({ value: "%bad%escape" }), `${PLAT}/api`, "%bad%escape"],
    [xsrfCookie({ value: "" }), `${PLAT}/api`, null],
  ]) {
    await Http.restore({ csrfTokens: {}, cookies: [cookie] }).request("POST", url, { xsrf: true })
    assert.equal(calls.at(-1).headers.get("X-XSRF-TOKEN"), expected)
  }
  await Http.restore({ csrfTokens: {}, cookies: [xsrfCookie()] }).request("POST", `${PLAT}/api`)
  assert.equal(calls.at(-1).headers.get("X-XSRF-TOKEN"), null)
})

const questions = [{ id: 9, answers: [{ blank_symbol: null, answer_option_key: "A" }] }]
const section = { question_section_id: 4, questions }
const numbered = [{ question_number: 1, answers: questions[0].answers }]
const settings = { learning_minutes: 15, plan: "focus_weakness", day_of_weeks: ["monday", "friday"] }
const trainingCases = [
  ["submitAnswers", "/student/task_training/lesson_student_task_learning_topics/1/answer_submissions", "POST", { id: 4, ...section }, (api, body) => api.submitAnswers(1, body)],
  ["submitLessonAnswers", "/student/task_training/lesson_student_task_learning_topics/1/answer_submissions", "POST", section, (api, body) => api.submitLessonAnswers(1, body)],
  ["submitPersonalizedAnswers", "/student/task_training/personalized_student_tasks/1/answer_submissions", "POST", { ...section, current_answer_submissions_count: 2 }, (api, body) => api.submitPersonalizedAnswers(1, body)],
  ["submitTaskTestAnswers", "/student/task_training/student_tasks/1/test_answer_submissions", "POST", [{ id: 4, questions }], (api, body) => api.submitTaskTestAnswers(1, body)],
  ["submitRecommendedAnswers", "/student/task_training/student_tasks/1/question_sections/4/recommended_question_section_answer_submissions", "POST", { id: 4, questions }, (api, body) => api.submitRecommendedAnswers(1, 4, body)],
  ["submitSelfTrainingAnswers", "/student/self_training/question_sections/4/answers?submission_context=self_training_drill", "POST", numbered, (api, body) => api.submitSelfTrainingAnswers(4, body, "self_training_drill")],
  ["submitLegacySelfTrainingAnswers", "/student/question_sections/4/answers?submission_context=self_training", "POST", [{ ...numbered[0], is_correct: true }], (api, body) => api.submitLegacySelfTrainingAnswers(4, body, "self_training")],
  ["submitShikakuAnswers", "/student/shikaku_self_training/question_sections/4/answers?submission_context=self_training_shikaku", "POST", numbered, (api, body) => api.submitShikakuAnswers(4, body, "self_training_shikaku")],
  ["submitKoumuinAnswers", "/student/koumuin_self_training/question_sections/4/answers", "POST", numbered, (api, body) => api.submitKoumuinAnswers(4, body)],
  ["submitShushokuAnswers", "/student/shushoku_self_training/question_sections/4/answers", "POST", numbered, (api, body) => api.submitShushokuAnswers(4, body)],
  ["submitDailyMissionAnswers", "/student/adaptive_training/daily_missions/1/answer_submissions", "POST", section, (api, body) => api.submitDailyMissionAnswers(1, body)],
  ["createMission", "/student/adaptive_training/missions", "POST", { ...settings, learning_target: { type: "subject", subject_id: 3 } }, (api, body) => api.createMission(body)],
  ["updateMission", "/student/adaptive_training/missions/1", "PUT", settings, (api, body) => api.updateMission(1, body)],
  ["deleteMission", "/student/adaptive_training/missions/1", "DELETE", undefined, (api) => api.deleteMission(1)],
  ["createDailyMission", "/student/adaptive_training/missions/1/daily_missions", "POST", undefined, (api) => api.createDailyMission(1)],
]

for (const [name, path, method, payload, invoke] of trainingCases) {
  test(`training.${name}: exact route, JSON body and cached CSRF header`, async (t) => {
    const calls = mockFetch(t, () => json({ id: 7, answerId: 7 }))
    assert.deepEqual(await invoke(client({ training: "cached" }).training, payload), { id: 7, answerId: 7 })
    assert.equal(calls.length, 1)
    const call = calls[0]
    assert.equal(call.url, TRAINING + path)
    assert.equal(call.method, method)
    assert.equal(call.body, payload === undefined ? undefined : JSON.stringify(payload))
    assert.equal(call.headers.get("Content-Type"), payload === undefined ? null : "application/json")
    assert.equal(call.headers.get("X-CSRF-TOKEN"), "cached")
    assert.equal(call.headers.get("X-XSRF-TOKEN"), null)
    assert.equal(call.headers.get("Origin"), "https://training.classi.jp")
    assert.equal(call.headers.get("Referer"), "https://training.classi.jp/student/")
  })

  test(`training.${name}: non-CSRF errors preserve status and body`, async (t) => {
    const calls = mockFetch(t, () => json({ error: "denied" }, 403))
    await assert.rejects(() => invoke(client({ training: "cached" }).training, payload), (error) => {
      assert.ok(error instanceof ClassiError)
      assert.equal(error.status, 403)
      assert.equal(error.endpoint, path)
      assert.deepEqual(error.body, { error: "denied" })
      return true
    })
    assert.equal(calls.length, 1)
  })

  if (payload !== undefined && name !== "createMission" && name !== "updateMission") {
    test(`training.${name}: empty answers are serialized without changing the request shape`, async (t) => {
      const calls = mockFetch(t, () => json({}))
      const empty = Array.isArray(payload) ? [] : { ...payload, questions: [] }
      await invoke(client({ training: "cached" }).training, empty)
      assert.equal(calls[0].body, JSON.stringify(empty))
    })
  }
}

test("training: legacy endpoint HTML 404 is preserved without retry or automatic migration", async (t) => {
  const body = "<!doctype html><title>The page you were looking for doesn't exist (404 Not found)</title>"
  const calls = mockFetch(t, () => new Response(body, { status: 404, headers: { "Content-Type": "text/html" } }))
  await assert.rejects(
    () => client({ training: "cached" }).training.submitLegacySelfTrainingAnswers(4, [{ ...numbered[0], is_correct: true }], "self_training_drill"),
    (error) => {
      assert.ok(error instanceof ClassiError)
      assert.equal(error.status, 404)
      assert.equal(error.body, body)
      assert.equal(error.endpoint, "/student/question_sections/4/answers?submission_context=self_training_drill")
      return true
    },
  )
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, `${TRAINING}/student/question_sections/4/answers?submission_context=self_training_drill`)
})

test("training: optional contexts are omitted; personalized count is optional", async (t) => {
  const calls = mockFetch(t)
  const api = client({ training: "cached" }).training
  await api.submitSelfTrainingAnswers(4, [])
  await api.submitShikakuAnswers(4, [])
  await api.submitPersonalizedAnswers(1, { question_section_id: 4, questions: [] })
  await api.submitLegacySelfTrainingAnswers(4, [])
  assert.equal(calls[0].url, `${TRAINING}/student/self_training/question_sections/4/answers`)
  assert.equal(calls[1].url, `${TRAINING}/student/shikaku_self_training/question_sections/4/answers`)
  assert.equal(calls[2].body, '{"question_section_id":4,"questions":[]}')
  assert.equal(calls[3].url, `${TRAINING}/student/question_sections/4/answers`)
})

test("training: new writes acquire a token and retry 422 once without losing context", async (t) => {
  let tokens = 0
  let writes = 0
  const calls = mockFetch(t, ({ url }) => {
    if (url.endsWith("/csrf_token")) return json({ token: `token-${++tokens}` })
    return ++writes === 1 ? json({}, 422) : json({ id: 7 })
  })
  assert.deepEqual(await client().training.submitSelfTrainingAnswers(4, numbered, "self_training"), { id: 7 })
  assert.equal(calls.length, 4)
  assert.equal(calls[0].url, `${TRAINING}/csrf_token`)
  assert.equal(calls[0].method, "GET")
  assert.equal(calls[0].headers.get("X-CSRF-TOKEN"), null)
  assert.equal(calls[1].headers.get("X-CSRF-TOKEN"), "token-1")
  assert.equal(calls[3].headers.get("X-CSRF-TOKEN"), "token-2")
  assert.equal(calls[3].url, `${TRAINING}/student/self_training/question_sections/4/answers?submission_context=self_training`)
  assert.equal(calls[3].body, calls[1].body)
})

test("study: report date is in JSON body, not query; form is not mutated", async (t) => {
  const calls = mockFetch(t)
  const form = Object.freeze({ activityTimeReports: {}, satisfactionRate: {}, subjectLearningReports: [], studentMessage: null })
  await client().study.saveReportForm("2030-01-02", form)
  assert.equal(calls[0].method, "PUT")
  assert.equal(calls[0].url, "https://study.classi.jp/api/study/my_report/form")
  assert.equal(calls[0].headers.get("Content-Type"), "application/json")
  assert.equal(calls[0].headers.get("X-CSRF-TOKEN"), null)
  assert.equal(calls[0].body, JSON.stringify({ ...form, date: "2030-01-02" }))
  assert.equal(Object.hasOwn(form, "date"), false)
})

test("study: target GTZ uses target_gtz_name for existing array and string callers", async (t) => {
  const calls = mockFetch(t)
  const api = client().study
  await api.setTargetGtz(["B1"])
  await api.setTargetGtz("A1")
  for (const call of calls) {
    assert.equal(call.method, "POST")
    assert.equal(call.url, "https://study.classi.jp/api/study/target_gtz")
    assert.equal(call.headers.get("Content-Type"), "application/json")
    assert.equal(call.headers.get("X-CSRF-TOKEN"), null)
  }
  assert.equal(calls[0].body, '{"target_gtz_name":"B1"}')
  assert.equal(calls[1].body, '{"target_gtz_name":"A1"}')
  assert.throws(() => api.setTargetGtz([]), /exactly one target GTZ/)
  assert.throws(() => api.setTargetGtz(["A1", "B1"]), /exactly one target GTZ/)
  assert.equal(calls.length, 2)
})

test("study: corrected write routes preserve HTTP errors", async (t) => {
  const calls = mockFetch(t, () => json({ error: "denied" }, 403))
  const api = client().study
  await assert.rejects(() => api.saveReportForm("2030-01-02", {}), (error) => error instanceof ClassiError && error.status === 403)
  await assert.rejects(() => api.setTargetGtz(["B1"]), (error) => error instanceof ClassiError && error.status === 403)
  assert.equal(calls.length, 2)
})

test("write API public declarations accept supported payloads and reject invalid contexts", () => {
  const result = spawnSync(process.execPath, ["node_modules/typescript/bin/tsc", "--noEmit", "--strict", "--skipLibCheck", "--module", "NodeNext", "--target", "ES2022", "tests/write-shapes.ts"], { encoding: "utf8" })
  assert.equal(result.status, 0, result.stdout + result.stderr)
})
