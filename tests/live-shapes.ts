import type { IdApiStatus, StudentTaskSummary, StudyReportForm, StudyUser, LoginContinueStatus } from "../dist/index.js"
import type {
  ClassiClient, SchoolLoginOptions, AssignedQuestionnaire, AnsweredQuestionnaire,
  QuestionnaireInfo, QuestionnaireDetail, QuestionnaireText, ActivityRecordDetail,
  PortfolioTemplate, PortfolioMark, GraduationMessageStatus, KarteTestSummary,
  KarteBenesseExam, KarteTestDetailParams,
} from "../dist/index.js"
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

const loginOptions: SchoolLoginOptions = {
  password: { recaptcha_required: { teacher: false, student: false, parent: false } },
  password_reset_by_email: { teacher: false, student: false, parent: false },
}
const answered: AnsweredQuestionnaire = { distribution_id: "distribution", distribution_at: "", creator_id: "creator", group_id: "group", group_name: "Synthetic", questionnaire_name: "Synthetic", questionnaire_category: "", submission_at: "", create_user_name: "Synthetic" }
const assigned: AssignedQuestionnaire = { ...answered, deadline_at: null, distribution_teacher_flag: "0", distribution_student_flag: "1", distribution_guardian_flag: "0", question_count: "1", new_flag: "0", resubmit_flag: "0", answering_flag: 0 }
const info: QuestionnaireInfo = { id: "distribution", questionnaire_id: "questionnaire", questionnaire_name: "Synthetic", question_count: "1", deadline_at: null, anonymous_flag: "0", file_attachment_flag: 0, questionnaire_category: "", subject_category: null, subject: null, big_teaching_unit: null, middle_teaching_unit: null, small_teaching_unit: null, answer_user_id: null, examination_at: null, submission_at: null }
const text: QuestionnaireText = { id: "text", type: null, src: null, text: "Synthetic" }
const questionnaireDetail: QuestionnaireDetail = {
  distributor_id: "distributor",
  test_data: { type: "synthetic", id: "questionnaire", creator: "creator", title: "Synthetic", description: [text], sections: [{ type: "synthetic", id: "section", creator: "creator", title: "Synthetic", description: [], body: [text], commentary: [], attached: [], questions: [{ body: [text], format: { type: "synthetic", required: false, answer_options: [text], label: ["Synthetic"], after_label: null } }, { body: [], format: { type: "synthetic", required: false } }], point: "0", target_time: 0, copyright: null, format_version: "synthetic" }], attached: [], copyright: null, format_version: "synthetic" },
  test_result_data: { sections: [] },
}
const activity: ActivityRecordDetail = { id: 7, category_id: null, record_type: "synthetic", create_user_id: 7, update_user_id: null, space_id: null, published: false, self_assessments_count: 0, teacher_assessments_count: 0, cross_assessments_count: 0, assessments_count: 0, record: { id: 7, title: "Synthetic", content: "Synthetic", created_at: "", updated_at: null }, category_name: null, albums: [], created_at: "", updated_at: null }
const activityId: number = activity.id
const responseActivity: ActivityRecordDetail = { ...activity, update_user_id: 7, record: { id: 8, title: "Synthetic", created_at: "", updated_at: null, questions: [{ text: "Synthetic", src: null }], answers: [{ text: "Synthetic", attached: null, attached_file_name: null }] } }
const template: PortfolioTemplate = { id: 7, title: "Synthetic", content: "Synthetic", sort_number: 0 }
const mark: PortfolioMark = { id: 7, name: "Synthetic", icon: "synthetic" }
const graduationStatus: GraduationMessageStatus = { is_delivered: false }
const metadata: KarteTestDetailParams = { name: "Synthetic", exam_date: "2030-01-01", national_display_code: "N", prefecture_display_code: "P", school_display_code: "S", gtz_output_flg: "0" }
const benesseExam: KarteBenesseExam = { id: "synthetic-exam", name: "Synthetic", exam_date: "2030-01-01", national_display_code: "N", prefecture_display_code: "P", school_display_code: "S", gtz_output_flg: "0", for_teacher: false }
const regularTest: KarteTestSummary = { id: "synthetic-test", kind: 1, name: "Synthetic", start_on: "", end_on: "", date: "", detail: { labels: [], kind: { id: 7, name: "Synthetic", identifier: "synthetic" } } }
const benesseTest: KarteTestSummary = { ...regularTest, kind: "synthetic", detail: { bc_results: { exam: benesseExam } } }
declare const client: ClassiClient
const loginOptionsResult: Promise<SchoolLoginOptions> = client.id.schoolLoginOptions()
const assignedResult: Promise<AssignedQuestionnaire[]> = client.platform.assignedQuestionnaires()
const answeredResult: Promise<AnsweredQuestionnaire[]> = client.platform.answeredQuestionnaires()
const infoResult: Promise<QuestionnaireInfo> = client.platform.questionnaireInfo("distribution", "group")
const detailResult: Promise<QuestionnaireDetail> = client.platform.questionnaireDetail("distribution")
const bookmarksResult: Promise<unknown[]> = client.platform.bookmarks()
const activityResult: Promise<ActivityRecordDetail> = client.portfolio.activityRecord(7)
const templatesResult: Promise<{ templates: PortfolioTemplate[] }> = client.portfolio.templates()
const marksResult: Promise<{ marks: PortfolioMark[] }> = client.portfolio.marks()
const statusResult: Promise<GraduationMessageStatus> = client.portfolio.graduationMessageStatus()
const urlResult: Promise<{ url: string }> = client.karte.trainingBenesseTestUrl()
const testResult: Promise<KarteTestSummary | undefined> = client.karte.testResults("user", 42, 1, "classroom")
void testResult
client.karte.testDetail("user", benesseExam.id, metadata)
client.karte.tests("user", 1, "classroom")
client.karte.pathways("user", 1, "classroom")
client.platform.groups(2030)
client.platform.newMessages(2030)
void [loginOptions, assigned, answered, info, questionnaireDetail, activity, activityId, responseActivity, template, mark, graduationStatus, regularTest, benesseTest, loginOptionsResult, assignedResult, answeredResult, infoResult, detailResult, bookmarksResult, activityResult, templatesResult, marksResult, statusResult, urlResult]
