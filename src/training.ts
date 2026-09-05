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
