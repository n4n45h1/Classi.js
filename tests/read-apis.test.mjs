import assert from "node:assert/strict"
import test from "node:test"
import { ClassiClient, ClassiError } from "../dist/index.js"

const cases = [
  ["training", "todayMissions", [], "/api/student/adaptive_training/today_missions"],
  ["training", "missions", [], "/api/student/adaptive_training/missions"],
  ["training", "mission", [12], "/api/student/adaptive_training/missions/12"],
  ["training", "thisWeekDailyMission", [12], "/api/student/adaptive_training/missions/12/this_week_daily_mission"],
  ["training", "todayDailyMission", [12], "/api/student/adaptive_training/missions/12/today_daily_mission"],
  ["training", "weeklyReport", [2026, 40], "/api/student/adaptive_training/weekly_report?year=2026&week=40"],
  ["training", "dailyMissionRecords", [2026, 40], "/api/student/adaptive_training/weekly_report/daily_mission_records?year=2026&week=40"],
  ["training", "recommendedStudentTask", [], "/api/student/task_training/recommended_student_task"],
  ["training", "careerTrainingCategories", ["koumuin"], "/api/student/koumuin_self_training/categories"],
  ["training", "careerTrainingCategories", ["shushoku"], "/api/student/shushoku_self_training/categories"],
  ["training", "qualificationTrainingCategories", [], "/api/student/shikaku_self_training/categories"],
  ["training", "koumuinQuestionSections", [12], "/api/student/koumuin_self_training/unit_level3/12/question_sections"],
  ["study", "unrecordedUsers", ["2026-09-04&x=1"], "/api/study/learning_reports/unrecorded_users?date=2026-09-04%26x%3D1"],
  ["platform", "webtestExaminations", [], "/api/v2/webtest/examinations?page=1"],
  ["platform", "webtestExaminations", [2], "/api/v2/webtest/examinations?page=2"],
  ["platform", "webtestResults", [3], "/api/v2/webtest/examinations/results?page=3"],
  ["platform", "searchTalkrooms", [], "/api/v3/talkrooms/search", "POST"],
  ["platform", "cbankStat", [], "/api/cbank/stat"],
  ["platform", "groupYears", [], "/api/v2/groups/years?display_this_year=1"],
  ["platform", "groupYears", [false], "/api/v2/groups/years?display_this_year=0"],
  ["platform", "subjectList", [], "/api/subject/list"],
  ["platform", "schoolageList", [], "/api/schoolage/list"],
  ["platform", "questionnaireCategories", [], "/api/questionnaire/categories"],
  ["platform", "calendarEvents", ["start", "end"], "/api/event/list?start_at=start&end_at=end"],
  ["platform", "calendarEvents", ["start", "end", "a&b"], "/api/event/list?start_at=start&end_at=end&event_type=a%26b"],
  ["platform", "calendarEvents", ["start", "end", ""], "/api/event/list?start_at=start&end_at=end&event_type="],
  ["portfolio", "spaces", [], "/api/v1/student/spaces?page=1"],
  ["portfolio", "spaces", [2], "/api/v1/student/spaces?page=2"],
  ["portfolio", "stories", [1], "/api/v2/student/stories?grade=1"],
  ["portfolio", "storyCategories", [], "/api/v2/story_categories"],
  ["portfolio", "storyComments", [2], "/api/v2/student/story_comments?grade=2"],
]

test("new read wrappers: routes, defaults, bodies, empty responses and HTTP errors", async t => {
  const hosts = { training: "training-api", study: "study", platform: "platform", portfolio: "portfolio" }
  const c = new ClassiClient()
  for (const [service, method, args, path, verb = "GET"] of cases) {
    for (const data of [{ sample: true }, [], null]) {
      let calls = 0
      t.mock.method(globalThis, "fetch", async (url, opts) => {
        calls++
        assert.equal(String(url), `https://${hosts[service]}.classi.jp${path}`)
        assert.equal(opts.method, verb)
        assert.equal(opts.body, undefined)
        assert.equal(opts.headers["X-CSRF-Token"], undefined)
        assert.equal(opts.headers["x-xsrf-token"], undefined)
        return new Response(JSON.stringify(data))
      })
      assert.deepEqual(await c[service][method](...args), data)
      assert.equal(calls, 1)
      t.mock.restoreAll()
    }
    t.mock.method(globalThis, "fetch", async () => new Response('{"error":true}', { status: 403 }))
    await assert.rejects(c[service][method](...args), e => e instanceof ClassiError && e.status === 403 && e.body.error === true)
    t.mock.restoreAll()
  }
})

test("video queries share restored cookies, use variables, and unwrap data", async t => {
  const c = new ClassiClient()
  const session = c.session
  session.cookies.push({ name: "sid", value: "fixture", domain: "classi.jp", path: "/", secure: true, hostOnly: false })
  const restored = ClassiClient.fromSession(session)
  const page = { nodes: [], totalCount: 0, pageInfo: { hasNextPage: false, endCursor: null, __typename: "PageInfo" }, __typename: "Videos" }
  const detail = { id: "video-id", title: "Video", __typename: "DaigakuNyushiVideo", durationSeconds: 60, expiringEmbedding: { playerURL: "https://example.org/player", expiresAtEpoch: 100, __typename: "Embedding" } }
  let calls = 0
  t.mock.method(globalThis, "fetch", async (url, opts) => {
    calls++
    assert.equal(String(url), "https://kuroko.classi.jp/public/graphql")
    assert.equal(opts.method, "POST")
    assert.equal(opts.headers.Cookie, "sid=fixture")
    assert.equal(opts.headers["X-CSRF-Token"], undefined)
    const body = JSON.parse(opts.body)
    assert.match(body.query, /query /)
    assert.doesNotMatch(body.query, /mutation/)
    if (body.operationName === "VideosByCategory") {
      assert.deepEqual(body.variables, calls === 1
        ? { videoCategorty: "CATEGORY_OTHER", first: 100, after: null }
        : { videoCategorty: "CATEGORY_OTHER", first: 2, after: "cursor&value" })
      return new Response(JSON.stringify({ data: { videosByCategory: page } }))
    }
    assert.deepEqual(body.variables, calls === 3
      ? { videoId: "id\"with-quotes", expireInSeconds: 300 }
      : { videoId: "video-id", expireInSeconds: 90 })
    return new Response(JSON.stringify({ data: { video: calls === 3 ? null : detail } }))
  })
  assert.deepEqual(await restored.video.videosByCategory("CATEGORY_OTHER"), page)
  assert.deepEqual(await restored.video.videosByCategory("CATEGORY_OTHER", 2, "cursor&value"), page)
  assert.equal(await restored.video.video('id"with-quotes'), null)
  assert.deepEqual(await restored.video.video("video-id", 90), detail)
  assert.equal(calls, 4)
})

test("video rejects GraphQL errors, missing data and HTTP failures", async t => {
  const c = new ClassiClient()
  for (const [status, body] of [[200, { errors: [{ message: "unauthorized" }], data: { video: null } }], [200, {}], [401, { errors: [] }]]) {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(body), { status }))
    for (const call of [() => c.video.video("id"), () => c.video.videosByCategory("CATEGORY_OTHER")]) {
      await assert.rejects(call, e => e instanceof ClassiError && e.status === status && e.endpoint.endsWith("/public/graphql"))
    }
    t.mock.restoreAll()
  }
})
