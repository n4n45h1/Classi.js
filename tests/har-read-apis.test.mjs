import assert from "node:assert/strict"
import test from "node:test"
import { ClassiClient, ClassiError } from "../dist/index.js"

const cases = [
  ["platform", "assignedQuestionnaires", [], "/api/questionnaire/examination/list"],
  ["platform", "answeredQuestionnaires", [], "/api/questionnaire/answered/list"],
  ["platform", "questionnaireInfo", ["distribution/a", "group&b"], "/api/questionnaire/examination/distribution%2Fa/group%26b/info"],
  ["platform", "questionnaireDetail", ["distribution/a"], "/api/questionnaire/examination/distribution%2Fa/detail"],
  ["platform", "bookmarks", [], "/api/v2/groups/bookmarks"],
  ["platform", "groups", [], "/api/v2/groups/"],
  ["platform", "groups", [0], "/api/v2/groups/?year=0"],
  ["platform", "groups", ["year&value"], "/api/v2/groups/?year=year%26value"],
  ["platform", "newMessages", [], "/api/v2/groups/newmessages"],
  ["platform", "newMessages", [0], "/api/v2/groups/newmessages?year=0"],
  ["platform", "newMessages", ["year&value"], "/api/v2/groups/newmessages?year=year%26value"],
  ["portfolio", "activityRecord", ["record/a"], "/api/v1/activity_records/record%2Fa"],
  ["portfolio", "activityRecord", [7], "/api/v1/activity_records/7"],
  ["portfolio", "templates", [], "/api/v1/templates"],
  ["portfolio", "marks", [], "/api/v2/marks"],
  ["portfolio", "graduationMessageStatus", [], "/api/v2/student/graduation_messages/delivered_status"],
  ["karte", "trainingBenesseTestUrl", [], "/training_benesse_test_url"],
  ["karte", "tests", ["user/a", 1], "/api/users/user%2Fa/tests?kind=1"],
  ["karte", "tests", ["user/a", 1, 0], "/api/users/user%2Fa/tests?kind=1&classroom_id=0"],
  ["karte", "tests", ["user/a", 1, "class&room"], "/api/users/user%2Fa/tests?kind=1&classroom_id=class%26room"],
  ["karte", "pathways", ["user/a"], "/api/users/user%2Fa/pathways?type=1"],
  ["karte", "pathways", ["user/a", 2, "class&room"], "/api/users/user%2Fa/pathways?type=2&classrooms_id=class%26room"],
  ["karte", "pathways", ["user/a", 1, 0], "/api/users/user%2Fa/pathways?type=1&classrooms_id=0"],
  ["karte", "testDetail", ["user/a", "exam/b"], "/api/users/user%2Fa/tests/exam%2Fb"],
  ["karte", "testDetail", ["user/a", "exam/b", {}], "/api/users/user%2Fa/tests/exam%2Fb"],
  ["karte", "testDetail", ["user/a", "exam/b", { name: "Synthetic & exam", exam_date: "2030-01-01", national_display_code: "N/A", prefecture_display_code: "P?", school_display_code: "S#", gtz_output_flg: "0" }], "/api/users/user%2Fa/tests/exam%2Fb?name=Synthetic+%26+exam&exam_date=2030-01-01&national_display_code=N%2FA&prefecture_display_code=P%3F&school_display_code=S%23&gtz_output_flg=0"],
  ["karte", "testDetail", [7, "exam", { name: "", exam_date: undefined }], "/api/users/7/tests/exam?name="],
]

test("HAR read wrappers and filters: GET-only routes, encoding, empty responses and HTTP errors", async t => {
  const client = new ClassiClient()
  for (const [service, method, args, path] of cases) {
    for (const data of [{ sample: true }, [], null]) {
      let calls = 0
      t.mock.method(globalThis, "fetch", async (url, opts) => {
        calls++
        assert.equal(String(url), `https://${service}.classi.jp${path}`)
        assert.equal(opts.method, "GET")
        assert.equal(opts.body, undefined)
        assert.equal(opts.headers["X-CSRF-Token"], undefined)
        assert.equal(opts.headers["x-xsrf-token"], undefined)
        return new Response(JSON.stringify(data))
      })
      assert.deepEqual(await client[service][method](...args), data)
      assert.equal(calls, 1)
      t.mock.restoreAll()
    }
    t.mock.method(globalThis, "fetch", async () => new Response('{"error":true}', { status: 403 }))
    await assert.rejects(client[service][method](...args), e => e instanceof ClassiError && e.status === 403 && e.body.error === true)
    t.mock.restoreAll()
  }
})

test("school login options unwrap the ID envelope without CSRF or writes", async t => {
  const client = new ClassiClient()
  const options = {
    password: { recaptcha_required: { teacher: false, student: true, parent: false } },
    password_reset_by_email: { teacher: true, student: false, parent: true },
  }
  let calls = 0
  t.mock.method(globalThis, "fetch", async (url, opts) => {
    calls++
    assert.equal(String(url), "https://id-api.classi.jp/api/v1/school/login_options")
    assert.equal(opts.method, "GET")
    assert.equal(opts.body, undefined)
    assert.equal(opts.headers["X-CSRF-Token"], undefined)
    return new Response(JSON.stringify({ success: true, data: options }))
  })
  assert.deepEqual(await client.id.schoolLoginOptions(), options)
  assert.equal(calls, 1)
  t.mock.restoreAll()
  for (const [status, body] of [[403, { success: false }], [200, { success: false, data: options }], [200, { success: true, data: null }], [200, {}]]) {
    t.mock.method(globalThis, "fetch", async () => new Response(JSON.stringify(body), { status }))
    await assert.rejects(client.id.schoolLoginOptions(), e => e instanceof ClassiError && e.status === status)
    t.mock.restoreAll()
  }
})
