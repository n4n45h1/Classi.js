import { ClassiClient } from "../dist/index.js"
import { readFileSync } from "node:fs"

const session = JSON.parse(readFileSync(new URL("./session.json", import.meta.url), "utf8"))
const client = ClassiClient.fromSession(session)

const now = new Date()
const jst = new Date(now.getTime() + (9 * 60 + now.getTimezoneOffset()) * 60000)
const year = jst.getFullYear()
const month = jst.getMonth() + 1

const tasks = await client.training.studentTasks(year, month, false)
console.log(`incomplete tasks: ${tasks.length}`)

for (const task of tasks) {
  const detail = await client.training.lessonStudentTask(task.id)
  console.log(`## ${task.id}: ${detail.lessonTask.title}`)
  for (const topic of detail.learningTopics) {
    console.log(`   topic ${topic.id}: ${topic.name} [${topic.progressStatus}]`)
  }
}

const summary = await client.training.activitySummary(year, month)
console.log("activity:", summary)
