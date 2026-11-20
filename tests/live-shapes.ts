import type { IdApiStatus, StudentTaskSummary, StudyReportForm, StudyUser, LoginContinueStatus } from "../dist/index.js"

declare const status: IdApiStatus
const oldId: number = status.old_id
declare const task: StudentTaskSummary
const category: typeof task.subjectCategory = { name: "subject" }
declare const user: StudyUser
const years: number[] = user.assessmentPermitYears
// @ts-expect-error Study does not return Training's school object.
user.school.id
const form: StudyReportForm = {
  activityTimeReports: { awokeAt: null, schoolAt: null, homeAt: null, workStartedAt: null, sleptAt: null },
  satisfactionRate: { timeRating: null, contentRating: null },
  subjectLearningReports: [],
  studentMessage: null,
}
form.subjectLearningReports.push({ subjectId: 1, name: "subject", learnedMinutes: null, color: "", stampUrl: "", note: null })
// @ts-expect-error The live report form has no subjectLearning property.
form.subjectLearning
declare const continuation: LoginContinueStatus
const totp: boolean | undefined = continuation.totp_required
void [oldId, category, years, totp]
