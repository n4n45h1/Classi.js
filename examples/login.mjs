import { ClassiClient } from "../dist/index.js"
import { writeFileSync } from "node:fs"

const USERNAME = process.env.CLASSI_USERNAME
const PASSWORD = process.env.CLASSI_PASSWORD

if (!USERNAME || !PASSWORD) {
  console.error("usage: CLASSI_USERNAME=your-id CLASSI_PASSWORD=your-pass node examples/login.mjs")
  process.exit(1)
}

const client = new ClassiClient({ username: USERNAME, password: PASSWORD })
const { status } = await client.login()
console.log("login:", status)

writeFileSync(
  new URL("./session.json", import.meta.url),
  JSON.stringify(client.session, null, 2),
  { mode: 0o600 }
)
console.log("session saved to examples/session.json (commit しないでください)")

const me = await client.training.currentUser()
console.log(`logged in as ${me.userFullName} (school ${me.schoolId})`)

const restored = ClassiClient.fromSession(client.session)
console.log("restored client user:", (await restored.training.currentUser()).userFullName)
