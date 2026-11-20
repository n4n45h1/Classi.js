import type { IdApiStatus, StudentTaskSummary, StudyReportForm, StudyUser, LoginContinueStatus } from "../dist/index.js"
import type {
  AdaptiveMissionSummary, AdaptiveMission, TodayMissions, DailyMissionStatus,
  AdaptiveWeeklyReport, DailyMissionRecord, RecommendedStudentTask,
  CareerTrainingCategory, QualificationTrainingCategory, KoumuinQuestionSections,
  UnrecordedUsers, GroupDetail, GroupMessages, WebtestExaminations, CbankStat,
  GroupYear, SubjectList, SchoolageList, QuestionnaireCategories,
  StudentSpaces, StoryCategory, StoryComments, VideoCategory, VideosByCategory, VideoDetail,
} from "../dist/index.js"

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

const missionSummary: AdaptiveMissionSummary = { id: 1, title: "", subjectName: "", learningMinutes: 1, dayOfWeeks: [] }
const mission: AdaptiveMission = { id: 1, title: "", subjectCategory: { id: 1, name: "" }, subject: { id: 1, name: "" }, plan: "", learningMinutes: 1, dayOfWeeks: [] }
const today: TodayMissions = { status: "", missions: [], progress: { completed: 0, total: 0 } }
const daily: DailyMissionStatus = { dayOfWeek: "", isCompleted: false }
const weekly: AdaptiveWeeklyReport = { submissionsCount: 0, awardType: "", completedCount: 0, totalAnswerDays: 0, subjectCategories: [], recommendedDrill: null }
const record: DailyMissionRecord = { date: "", totalAnswerSubmissionsCount: 0, missions: [] }
const recommended: RecommendedStudentTask = { studentTask: null, openStudentTaskCount: 0, incompleteStudentTaskCount: 0 }
const career: CareerTrainingCategory = { code: "", name: "", unitLevel2: [{ code: "", name: "", unitLevel3: [{ id: 1, code: "", name: "", isCompleted: false }] }] }
const qualification: QualificationTrainingCategory = { code: "", name: "", subjects: [{ code: "", name: "", middleTeachingUnits: [{ code: "", name: "", smallTeachingUnits: [{ id: 1, code: "", name: "", isCompleted: false }] }] }] }
const sections: KoumuinQuestionSections = { id: 1, name: "", code: "", remainingQuestions: 0, questionSections: [{ id: 1, title: "", answerStatus: "", answeredCount: 0 }] }
const unrecorded: UnrecordedUsers = { gradeName: "", classroomName: "", students: [{ attendanceNumber: 1, fullName: "", fullNameKana: "", photoUrl: "" }] }
const group: GroupDetail = { id: 1, name: "", color: 1, is_favorited: false, group_type: 1, description: "", edit_only: false, message_restricted: false, comment_restricted: false, like_restricted: false, group_message_restricted: false, group_comment_restricted: false, group_like_restricted: false, member_count: { total: 0, teacher: 0, inaccessible: 0, deleted: 0, student: 0 } }
const messages: GroupMessages = { group, messages: [] }
// @ts-expect-error Detail responses do not promise summary unread counters.
group.unread
// @ts-expect-error Detail responses do not promise summary sort order.
group.sort_no
const exams: WebtestExaminations = { total: 0, page: 1, distributions: [] }
declare const cbank: CbankStat
const uploadLimit: number = cbank.max_upload_size
const groupYear: GroupYear = { year_id: 1, year_name: "" }
const subjects: SubjectList = { subject_categories: { "1": { id: "1", name: "", order: "1", school_ages_id: "1", subjects: { "1": { id: "1", name: "", order: "1" } } } } }
const ages: SchoolageList = { school_ages: { "1": { name: "", order: "1", difficulties: { "1": { name: "", short_name: "", order: "1" } } } } }
const questionnaires: QuestionnaireCategories = { "1": { id: 1, name: "", order: 1 } }
const spaces: StudentSpaces = { spaces: [], pages: {} }
const storyCategory: StoryCategory = { id: 1, parent_id: null, name: "", icon: "", sub_categories: [{ id: 2, parent_id: 1, name: "", icon: null }] }
const comments: StoryComments = { story_comments: [], meta: { next_id: null } }
const videoCategory: VideoCategory = "CATEGORY_DAIGAKU_NYUSHI"
const videos: VideosByCategory = { pageInfo: { hasNextPage: false, endCursor: null, __typename: "" }, totalCount: 0, nodes: [], __typename: "" }
const video: VideoDetail = { id: "", title: "", __typename: "", durationSeconds: 1, expiringEmbedding: { playerURL: "", expiresAtEpoch: 1, __typename: "" } }
void [missionSummary, mission, today, daily, weekly, record, recommended, career, qualification, sections, unrecorded, messages, exams, uploadLimit, groupYear, subjects, ages, questionnaires, spaces, storyCategory, comments, videoCategory, videos, video]
