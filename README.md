# classi.js

Classi (classi.jp) を Node.js / TypeScript から扱うための、**非公式**のAPIクライアントです 

ログイン、課題(タスクトレーニング)の取得と回答送信、通知やグループメッセージの取得など、
Classi の Web 版でできることをコードからできるようにしました。

> ⚠️ このライブラリは非公式です。Classi株式会社 / 株式会社ベネッセコーポレーションとは関係ありません。
> 必ず**自分のアカウント**で、迷惑のかからない範囲で使ってください。
> 内部構造は実通信の観察に基づいているため、Classi側の更新で突然動かなくなるかもしれません。

## インストール

```bash
npm install classi.js
```

Node.js 18 以上を想定しています。依存パッケージはゼロです。

## はじめてのログイン

```ts
import { ClassiClient } from "classi.js"

const client = new ClassiClient({
  username: "your-id",
  password: "your-password",
})

await client.login()

const me = await client.training.currentUser()
console.log(`${me.userFullName} さん (${me.schoolId})`)
```

### ログインを毎回省略する

一度ログインしたらセッションを保存して、次回から使い回せます。

```ts
import { readFileSync, writeFileSync } from "node:fs"

// 保存
await client.login()
writeFileSync("session.json", JSON.stringify(client.session))

// 復元(ログインなしでOK)
const client = ClassiClient.fromSession(JSON.parse(readFileSync("session.json", "utf8")))
await client.training.currentUser()
```

`session.json` にはログイン済みCookieが入っているので、**公開リポジトリに上げないでください**。

## できること一覧

| プロパティ | 対象 | できること |
|---|---|---|
| `client.id` | id-api.classi.jp | ログイン、アカウント情報、ユーザー名/パスワード変更 |
| `client.training` | training-api.classi.jp | 課題の一覧・取得・回答送信・採点結果、自習トレーニング |
| `client.study` | study.classi.jp | 学習日報の読み書き、ランキング、GTZ目標 |
| `client.platform` | platform.classi.jp | 通知、グループ/メッセージ、既読、ブックマーク、カレンダー |
| `client.portfolio` | portfolio.classi.jp | 活動記録、作品、アルバム |
| `client.karte` | karte.classi.jp | テスト結果、学習レポート |

## よくある使い方

### 課題の一覧を見る

```ts
const tasks = await client.training.studentTasks(2026, 9, false)
for (const t of tasks) {
  console.log(t.task.title, t.progressStatus)
}
```

### 問題に回答して結果を見る

```ts
const detail = await client.training.lessonStudentTask(tasks[0].id)
const topic = detail.learningTopics[0]

const section = await client.training.questionSection(topic.nextQuestionSection.id)
const q = section.questions[0]

const res = await client.training.submitAnswers(topic.id, {
  id: section.id,
  question_section_id: section.id,
  questions: [
    {
      id: q.id,
      answers: [{ blank_symbol: null, answer_option_key: q.content.answerOptions![0].key }],
    },
  ],
})

const result = await client.training.answerResult(res.answerId)
console.log("正解:", result.questionSection.questionAnswers[0].isCorrect)

const next = await client.training.nextQuestionSection(topic.id)
```

### 通知とメッセージ

```ts
const unread = await client.platform.unreadCount()
const groups = await client.platform.groups()
const messages = await client.platform.groupMessages(groups.groups[0].id)
await client.platform.markSeen("12975")
```

### 学習日報を書く

```ts
const form = await client.study.reportForm("2026-09-04")
await client.study.saveReportForm("2026-09-04", {
  ...form,
  satisfactionRate: { timeRating: "3", contentRating: "3" },
})
```

## エラー処理

APIが2xx以外を返すと `ClassiError` がスローされます。`status` / `endpoint` / `body` を持っているので、原因の切り分けにそのまま使えます。

```ts
import { ClassiError } from "classi.js"

try {
  await client.training.lessonStudentTask(999999)
} catch (e) {
  if (e instanceof ClassiError) {
    console.error(`HTTP ${e.status} @ ${e.endpoint}`)
    console.error(JSON.stringify(e.body))
  }
}
```

| プロパティ | 型 | 内容 |
|---|---|---|
| `status` | `number` | HTTPステータスコード |
| `endpoint` | `string` | 呼び出したAPIのパス |
| `body` | `unknown` | サーバーからの生レスポンス |
| `message` | `string` | 人間可読な説明 |

### よくあるエラーと対処

| 状況 | 起きること | 対処 |
|---|---|---|
| ID/パスワードの誤り | `ClassiError("invalid username or password")` | 認証情報を確認 |
| CSRFトークン失効 | 422 が返る | training-api は**内部で自動再取得して再送**します。手動では `client.training.invalidateCsrf()` を |
| 存在しないリソース | 404 の `ClassiError` | ID の指定ミスがないか確認 |
| セッション切れ | 401 の `ClassiError` | `client.login()` し直すか、セッションを作り直す |
| ネットワーク障害 | ネイティブの `TypeError` | `ClassiError` とは別型なので `instanceof` で判定してください |

## 開発者向け

```bash
npm run build   # TypeScript のビルド (dist/)
npm test        # 結合テスト (実APIにアクセスします)
```

テストは実サーバーを使うため、認証情報は環境変数で渡します(未設定なら自動スキップ):

```bash
CLASSI_USERNAME=your-id CLASSI_PASSWORD=your-pass npm test
```

## License

MIT

---

❤️ Developed by **Nanachi** ([github.com/n4n45h1](https://github.com/n4n45h1)) & **GLM 5.3 Flash** (Z.ai)
