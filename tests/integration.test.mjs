import assert from "node:assert/strict"
import test from "node:test"
import { ClassiClient, ClassiError } from "../dist/index.js"

const USERNAME = process.env.CLASSI_USERNAME
const PASSWORD = process.env.CLASSI_PASSWORD

if (!USERNAME || !PASSWORD) {
  console.log("CLASSI_USERNAME / CLASSI_PASSWORD 未設定のため統合テストをスキップします")
  process.exit(0)
}

const client = new ClassiClient({ username: USERNAME, password: PASSWORD })

test("login: 正しい認証情報でログインできる", async () => {
  const { status } = await client.login()
  assert.equal(status.account_select_required, false)
  assert.equal(status.password_change_required, false)
})

test("login: 誤ったパスワードはClassiError", async () => {
  const bad = new ClassiClient({ username: USERNAME, password: "wrong-password" })
  await assert.rejects(
    () => bad.login(),
    (e) => e instanceof ClassiError && e.endpoint.includes("/login/with_password")
  )
})

test("training.currentUser: ログインユーザー情報が取れる", async () => {
  const me = await client.training.currentUser()
  assert.equal(me.userTypeId, 2)
  assert.ok(me.userId.length > 0)
  assert.ok(me.schoolId.length > 0)
})

test("training.studentTasks: 年月を指定して配列が返る", async () => {
  const done = await client.training.studentTasks(2026, 9, true)
  const open = await client.training.studentTasks(2026, 9, false)
  assert.ok(Array.isArray(done))
  assert.ok(Array.isArray(open))
  for (const t of done) {
    assert.equal(typeof t.id, "number")
    assert.equal(t.task.type, "lesson")
  }
})

test("training.activitySummary: 日別集計が返る", async () => {
  const s = await client.training.activitySummary(2026, 9)
  assert.ok(Array.isArray(s))
  if (s.length) {
    assert.match(s[0].date, /^\d{4}-\d{2}-\d{2}$/)
    assert.equal(typeof s[0].answerSubmissionCount, "number")
  }
})

test("training: 存在しないタスクはClassiError(404系)", async () => {
  await assert.rejects(
    () => client.training.lessonStudentTask(1),
    (e) => e instanceof ClassiError
  )
})

test("platform.groups: グループ一覧が取れる", async () => {
  const g = await client.platform.groups()
  assert.ok(Array.isArray(g.groups))
  assert.ok(g.groups.length > 0)
  assert.equal(typeof g.groups[0].id, "number")
})

test("platform.groupMessages: メッセージが取れる", async () => {
  const g = await client.platform.groups()
  const m = await client.platform.groupMessages(g.groups[0].id)
  assert.ok(m.group)
  assert.ok(Array.isArray(m.messages))
})

test("platform.unreadCount: 件数が返る", async () => {
  const u = await client.platform.unreadCount()
  assert.equal(typeof u.count, "number")
})

test("study.recordedDates: 記録済み日付が返る", async () => {
  const d = await client.study.recordedDates("2026-09")
  assert.ok(Array.isArray(d))
  for (const x of d) assert.match(x, /^\d{4}-\d{2}-\d{2}$/)
})

test("study.targetGtz: GTZ目標が取れる", async () => {
  const t = await client.study.targetGtz()
  assert.ok(Array.isArray(t.targetGTZs))
  assert.ok(t.targetGTZs.length > 0)
})

test("portfolio.userInfo: ユーザー情報が取れる", async () => {
  const pf = await client.portfolio.userInfo()
  assert.ok(pf.user_info)
  assert.ok(pf.user_info.name.length > 0)
})

test("karte.tests: テスト一覧が取れる", async () => {
  const me = await client.training.currentUser()
  const tests = await client.karte.tests(me.userId, 1)
  assert.ok(Array.isArray(tests))
})

test("セッション保存→復元でログインなしにAPIが使える", async () => {
  const session = client.session
  assert.ok(session.cookies.length > 0)
  const restored = ClassiClient.fromSession(session)
  const me = await restored.training.currentUser()
  assert.ok(me.userFullName.length > 0)
})

test("CSRF自動再取得: training.callは422時に自動リトライする", async () => {
  client.training.invalidateCsrf()
  const me = await client.training.currentUser()
  assert.ok(me.userFullName.length > 0)
})
