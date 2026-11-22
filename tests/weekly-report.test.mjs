import assert from "node:assert/strict"
import test from "node:test"
import { ClassiClient, ClassiError, latestCompletedIsoWeek } from "../dist/index.js"

test("latest completed ISO week uses JST and ISO week-years at year boundaries", () => {
  for (const [date, expected] of [
    ["2021-01-01T03:00:00Z", { year: 2020, week: 52 }],
    ["2021-01-03T15:00:00Z", { year: 2020, week: 53 }],
    ["2021-01-10T15:00:00Z", { year: 2021, week: 1 }],
    ["2025-01-05T15:00:00Z", { year: 2025, week: 1 }],
    ["2026-11-22T14:59:59.999Z", { year: 2026, week: 46 }],
    ["2026-11-22T15:00:00Z", { year: 2026, week: 47 }],
  ]) {
    assert.deepEqual(latestCompletedIsoWeek(new Date(date)), expected, date)
  }
  assert.throws(() => latestCompletedIsoWeek(new Date(NaN)), RangeError)
})

test("weekly report defaults use the completed JST week and preserve empty responses", async t => {
  const RealDate = Date
  t.mock.method(globalThis, "Date", class extends RealDate {
    constructor(...args) {
      super(...(args.length ? args : ["2021-01-03T15:00:00Z"]))
    }
  })
  assert.deepEqual(latestCompletedIsoWeek(), { year: 2020, week: 53 })
  const client = new ClassiClient()
  for (const [method, suffix, response] of [
    ["weeklyReport", "", { submissionsCount: 1, awardType: "bronze", completedCount: 0, totalAnswerDays: 1, subjectCategories: [], recommendedDrill: null }],
    ["dailyMissionRecords", "/daily_mission_records", [{ date: "2020-12-28", totalAnswerSubmissionsCount: 1, missions: [] }]],
  ]) {
    for (const data of [response, [], null]) {
      let calls = 0
      t.mock.method(globalThis, "fetch", async (url, opts) => {
        calls++
        assert.equal(String(url), `https://training-api.classi.jp/api/student/adaptive_training/weekly_report${suffix}?year=2020&week=53`)
        assert.equal(opts.method, "GET")
        assert.equal(opts.body, undefined)
        return new Response(JSON.stringify(data))
      })
      assert.deepEqual(await client.training[method](), data)
      assert.equal(calls, 1)
    }
    t.mock.method(globalThis, "fetch", async () => new Response('{"error":"unavailable"}', { status: 503 }))
    await assert.rejects(client.training[method](), e => e instanceof ClassiError && e.status === 503)
  }
})

test("explicit current/future weeks pass through and surface future_week without fallback", async t => {
  const client = new ClassiClient()
  for (const method of ["weeklyReport", "dailyMissionRecords"]) {
    let calls = 0
    const body = { errorType: "future_week", description: "未来の週は指定できません" }
    t.mock.method(globalThis, "fetch", async url => {
      calls++
      assert.equal(new URL(url).search, "?year=2099&week=53")
      return new Response(JSON.stringify(body), { status: 400 })
    })
    await assert.rejects(client.training[method](2099, 53), e => {
      assert.ok(e instanceof ClassiError)
      assert.equal(e.status, 400)
      assert.deepEqual(e.body, body)
      return true
    })
    assert.equal(calls, 1)
    assert.throws(() => client.training[method](2026), /year and week must be provided together/)
    assert.throws(() => client.training[method](undefined, 47), /year and week must be provided together/)
    assert.equal(calls, 1)
  }
})
