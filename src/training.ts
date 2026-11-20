import { Http, ClassiError } from "./http.js"
import type {
  ActivityDaySummary,
  AnswerResult,
  AnswerSubmissionResult,
  ClassiUser,
  LessonStudentTask,
  QuestionSection,
  StudentTaskSummary,
  SelfTrainingSubject,
  TopicProgress,
} from "./types.js"

const API = "https://training-api.classi.jp/api"
const ORIGIN = "https://training.classi.jp"
const REF = "https://training.classi.jp/student/"

export interface AnswerInput {
  blank_symbol?: string | null
  answer_option_key: string
}

export interface QuestionAnswerPayload {
  id: number
  answers: AnswerInput[]
}

export interface SubmitPayload {
  id: number
  questions: QuestionAnswerPayload[]
  question_section_id: number
}

export interface TrainingAnswerInput {
  blank_symbol: string | null
  answer_option_key: string
}

export interface TrainingQuestionAnswer {
  id: number
  answers: TrainingAnswerInput[]
}

export interface LessonAnswerSubmission {
  question_section_id: number
  questions: TrainingQuestionAnswer[]
}

export interface PersonalizedAnswerSubmission extends LessonAnswerSubmission {
  current_answer_submissions_count?: number
}

export interface TaskQuestionSectionAnswers {
  id: number
  questions: TrainingQuestionAnswer[]
}

export interface NumberedQuestionAnswers {
  question_number: number
  answers: TrainingAnswerInput[]
}

export interface LegacyNumberedQuestionAnswers extends NumberedQuestionAnswers {
  is_correct: boolean
}

export type LegacySelfTrainingSubmissionContext = "self_training" | "self_training_drill"

export type SelfTrainingSubmissionContext = "self_training" | "self_training_drill" |
  "self_training_benesse_test_summary" | "self_training_benesse_test_summary_recommendation"
export type ShikakuSubmissionContext = "self_training_recommended_question" | "self_training_shikaku"
export type MissionPlan = "catch_up_with_rivals" | "lead_rivals" | "focus_weakness"
export type MissionDay = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday"

export interface MissionSettings {
  learning_minutes: number
  plan: MissionPlan
  day_of_weeks: MissionDay[]
}

export interface CreateMissionPayload extends MissionSettings {
  learning_target: { type: "subject"; subject_id: number }
}

export interface UpdatedMission {
  id: number
  title: string
  plan: string
  learningMinutes: number
  dayOfWeeks: MissionDay[]
}

export interface CreatedDailyMission {
  id: number
  nextQuestionSection: { id: number; number: number }
  questionSectionsCount: number
}

export interface AdaptiveMissionSummary {
  id: number
  title: string
  subjectName: string
  learningMinutes: number
  dayOfWeeks: string[]
}

export interface AdaptiveMission {
  id: number
  title: string
  subjectCategory: { id: number; name: string }
  subject: { id: number; name: string }
  plan: string
  learningMinutes: number
  dayOfWeeks: string[]
}

export interface TodayMissions {
  status: string
  missions: { id: number; subject: { id: number; name: string }; learningMinutes: number; plan: string; status: string }[]
  progress: { completed: number; total: number }
}

export interface DailyMissionStatus {
  dayOfWeek: string
  isCompleted: boolean
}

export interface AdaptiveWeeklyReport {
  submissionsCount: number
  awardType: string
  completedCount: number
  totalAnswerDays: number
  subjectCategories: unknown[]
  recommendedDrill: unknown
}

export interface DailyMissionRecord {
  date: string
  totalAnswerSubmissionsCount: number
  missions: unknown[]
}

export interface RecommendedStudentTask {
  studentTask: unknown
  openStudentTaskCount: number
  incompleteStudentTaskCount: number
}

export interface CareerTrainingCategory {
  code: string
  name: string
  unitLevel2: { code: string; name: string; unitLevel3: { id: number; code: string; name: string; isCompleted: boolean }[] }[]
}

export interface QualificationTrainingCategory {
  code: string
  name: string
  subjects: {
    code: string
    name: string
    middleTeachingUnits: { code: string; name: string; smallTeachingUnits: { id: number; code: string; name: string; isCompleted: boolean }[] }[]
  }[]
}

export interface KoumuinQuestionSections {
  id: number
  name: string
  code: string
  remainingQuestions: number
  questionSections: { id: number; title: string; answerStatus: string; answeredCount: number }[]
}

export class TrainingApi {
  constructor(private http: Http) {}

  private async csrf(): Promise<string> {
    const cached = this.http.csrfTokens["training"]
    if (cached) return cached
    const { status, data } = await this.http.request<{ token: string }>("GET", `${API}/csrf_token`, {
      origin: ORIGIN,
      referer: REF,
    })
    if (status < 200 || status >= 300 || typeof data?.token !== "string" || !data.token) throw new ClassiError("failed to obtain training csrf token", status, `${API}/csrf_token`, data)
    this.http.csrfTokens["training"] = data.token
    return data.token
  }

  invalidateCsrf(): void {
    delete this.http.csrfTokens["training"]
  }

  private async call<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, json?: unknown): Promise<T> {
    const attempt = async (token: string | undefined) =>
      this.http.request<T>(method, `${API}${path}`, {
        origin: ORIGIN,
        referer: REF,
        csrf: method !== "GET",
        csrfToken: token,
        json,
      })
    let res = await attempt(method === "GET" ? undefined : await this.csrf())
    if (method !== "GET" && res.status === 422) {
      this.invalidateCsrf()
      res = await attempt(await this.csrf())
    }
    if (res.status < 200 || res.status >= 300) {
      throw new ClassiError(`training api error: ${path}`, res.status, path, res.data)
    }
    return res.data
  }

  currentUser(): Promise<ClassiUser> {
    return this.call<ClassiUser>("GET", "/current_user")
  }

  todayMissions(): Promise<TodayMissions> {
    return this.call("GET", "/student/adaptive_training/today_missions")
  }

  missions(): Promise<AdaptiveMissionSummary[]> {
    return this.call("GET", "/student/adaptive_training/missions")
  }

  mission(id: number): Promise<AdaptiveMission> {
    return this.call("GET", `/student/adaptive_training/missions/${id}`)
  }

  thisWeekDailyMission(id: number): Promise<DailyMissionStatus[]> {
    return this.call("GET", `/student/adaptive_training/missions/${id}/this_week_daily_mission`)
  }

  todayDailyMission(id: number): Promise<{ status: string }> {
    return this.call("GET", `/student/adaptive_training/missions/${id}/today_daily_mission`)
  }

  weeklyReport(year: number, week: number): Promise<AdaptiveWeeklyReport> {
    return this.call("GET", `/student/adaptive_training/weekly_report?year=${year}&week=${week}`)
  }

  dailyMissionRecords(year: number, week: number): Promise<DailyMissionRecord[]> {
    return this.call("GET", `/student/adaptive_training/weekly_report/daily_mission_records?year=${year}&week=${week}`)
  }

  recommendedStudentTask(): Promise<RecommendedStudentTask> {
    return this.call("GET", "/student/task_training/recommended_student_task")
  }

  careerTrainingCategories(kind: "koumuin" | "shushoku"): Promise<CareerTrainingCategory[]> {
    return this.call("GET", `/student/${kind}_self_training/categories`)
  }

  qualificationTrainingCategories(): Promise<QualificationTrainingCategory[]> {
    return this.call("GET", "/student/shikaku_self_training/categories")
  }

  koumuinQuestionSections(unitLevel3Id: number): Promise<KoumuinQuestionSections> {
    return this.call("GET", `/student/koumuin_self_training/unit_level3/${unitLevel3Id}/question_sections`)
  }

  studentTasks(year: number, month: number, completed = false): Promise<StudentTaskSummary[]> {
    return this.call<StudentTaskSummary[]>(
      "GET",
      `/student/task_training/student_tasks?year=${year}&month=${month}&completed=${completed}`
    )
  }

  lessonStudentTask(id: number): Promise<LessonStudentTask> {
    return this.call<LessonStudentTask>("GET", `/student/task_training/lesson_student_tasks/${id}`)
  }

  questionSection(id: number): Promise<QuestionSection> {
    return this.call<QuestionSection>("GET", `/student/question_sections/${id}`)
  }

  submitAnswers(topicId: number, payload: SubmitPayload): Promise<AnswerSubmissionResult> {
    return this.call<AnswerSubmissionResult>(
      "POST",
      `/student/task_training/lesson_student_task_learning_topics/${topicId}/answer_submissions`,
      payload
    )
  }

  submitLessonAnswers(topicId: number, payload: LessonAnswerSubmission): Promise<AnswerSubmissionResult> {
    return this.call("POST", `/student/task_training/lesson_student_task_learning_topics/${topicId}/answer_submissions`, payload)
  }

  submitPersonalizedAnswers(taskId: number, payload: PersonalizedAnswerSubmission): Promise<AnswerSubmissionResult> {
    return this.call("POST", `/student/task_training/personalized_student_tasks/${taskId}/answer_submissions`, payload)
  }

  submitTaskTestAnswers(taskId: number, payload: TaskQuestionSectionAnswers[]): Promise<void> {
    return this.call("POST", `/student/task_training/student_tasks/${taskId}/test_answer_submissions`, payload)
  }

  submitRecommendedAnswers(taskId: number, sectionId: number, payload: TaskQuestionSectionAnswers): Promise<{ id: number }> {
    return this.call("POST", `/student/task_training/student_tasks/${taskId}/question_sections/${sectionId}/recommended_question_section_answer_submissions`, payload)
  }

  submitSelfTrainingAnswers(sectionId: number, answers: NumberedQuestionAnswers[], context?: SelfTrainingSubmissionContext): Promise<{ id: number }> {
    const query = context === undefined ? "" : `?submission_context=${encodeURIComponent(context)}`
    return this.call("POST", `/student/self_training/question_sections/${sectionId}/answers${query}`, answers)
  }

  submitLegacySelfTrainingAnswers(sectionId: number, answers: LegacyNumberedQuestionAnswers[], context?: LegacySelfTrainingSubmissionContext): Promise<{ id: number }> {
    const query = context === undefined ? "" : `?submission_context=${encodeURIComponent(context)}`
    return this.call("POST", `/student/question_sections/${sectionId}/answers${query}`, answers)
  }

  submitShikakuAnswers(sectionId: number, answers: NumberedQuestionAnswers[], context?: ShikakuSubmissionContext): Promise<{ id: number }> {
    const query = context === undefined ? "" : `?submission_context=${encodeURIComponent(context)}`
    return this.call("POST", `/student/shikaku_self_training/question_sections/${sectionId}/answers${query}`, answers)
  }

  submitKoumuinAnswers(sectionId: number, answers: NumberedQuestionAnswers[]): Promise<{ id: number }> {
    return this.call("POST", `/student/koumuin_self_training/question_sections/${sectionId}/answers`, answers)
  }

  submitShushokuAnswers(sectionId: number, answers: NumberedQuestionAnswers[]): Promise<{ id: number }> {
    return this.call("POST", `/student/shushoku_self_training/question_sections/${sectionId}/answers`, answers)
  }

  submitDailyMissionAnswers(missionId: number, payload: LessonAnswerSubmission): Promise<AnswerSubmissionResult> {
    return this.call("POST", `/student/adaptive_training/daily_missions/${missionId}/answer_submissions`, payload)
  }

  createMission(payload: CreateMissionPayload): Promise<{ id: number }> {
    return this.call("POST", "/student/adaptive_training/missions", payload)
  }

  updateMission(missionId: number, payload: MissionSettings): Promise<UpdatedMission> {
    return this.call("PUT", `/student/adaptive_training/missions/${missionId}`, payload)
  }

  deleteMission(missionId: number): Promise<void> {
    return this.call("DELETE", `/student/adaptive_training/missions/${missionId}`)
  }

  createDailyMission(missionId: number): Promise<CreatedDailyMission> {
    return this.call("POST", `/student/adaptive_training/missions/${missionId}/daily_missions`)
  }

  answerResult(answerId: number): Promise<AnswerResult> {
    return this.call<AnswerResult>("GET", `/student/answers/${answerId}`)
  }

  nextQuestionSection(
    topicId: number,
    scope: "current_learning_topic" = "current_learning_topic"
  ): Promise<{ nextQuestionSection: { id: number; number: number } | null }> {
    return this.call(
      "GET",
      `/student/task_training/lesson_student_task_learning_topics/${topicId}/next_question_section?scope=${scope}`
    )
  }

  topicProgress(topicId: number): Promise<TopicProgress> {
    return this.call<TopicProgress>(
      "GET",
      `/student/task_training/lesson_student_task_learning_topics/${topicId}/answer_submissions`
    )
  }

  activitySummary(year: number, month: number): Promise<ActivityDaySummary[]> {
    return this.call<ActivityDaySummary[]>("GET", `/student/activities/month/summary?year=${year}&month=${month}`)
  }

  selfTrainingSubjects(): Promise<SelfTrainingSubject[]> {
    return this.call<SelfTrainingSubject[]>("GET", "/student/self_training/subjects")
  }

  selfTeachingUnits(subjectCategoryId: number): Promise<unknown[]> {
    return this.call("GET", `/student/self_training/middle_teaching_units?subject_category_id=${subjectCategoryId}`)
  }

  academicAbilityTargets(): Promise<{ id: number; name: string; gtz: string | null }[]> {
    return this.call("GET", "/student/academic_ability_targets")
  }
}
