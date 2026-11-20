import { Http, ClassiError } from "./http.js"

const PORT = "https://portfolio.classi.jp"
const KARTE = "https://karte.classi.jp"

export interface PortfolioUserInfo {
  user_info: {
    school_id: number
    school_year: string
    id: number
    name: string
    user_type_id: number
    avatar: string
    class_name?: string
    [k: string]: unknown
  }
}

export interface ActivityRecord {
  id: number
  category_id: number | null
  record_type: string
  create_user_id: number
  update_user_id: number
  space_id: number | null
  published: boolean
  self_assessment?: unknown
  [k: string]: unknown
}

export interface StudentSpaces {
  spaces: unknown[]
  pages: Record<string, unknown>
}

export interface StoryCategory {
  id: number
  parent_id: null
  name: string
  icon: string
  sub_categories: { id: number; parent_id: number; name: string; icon: string | null }[]
}

export interface StoryComments {
  story_comments: unknown[]
  meta: { next_id: unknown }
}

export interface ActivityRecordDetail {
  id: number
  category_id: number | null
  record_type: string
  create_user_id: number
  update_user_id: number | null
  space_id: number | null
  published: boolean
  self_assessments_count: number
  teacher_assessments_count: number
  cross_assessments_count: number
  assessments_count: number
  record: {
    id: number
    title: string
    created_at: string
    updated_at: null
    content?: string
    questions?: { text: string; src: null }[]
    answers?: { text: string; attached: null; attached_file_name: null; src?: null }[]
    [k: string]: unknown
  }
  category_name: string | null
  albums: unknown[]
  created_at: string
  updated_at: null
  [k: string]: unknown
}

export interface PortfolioTemplate {
  id: number
  title: string
  content: string
  sort_number: number
}

export interface PortfolioMark {
  id: number
  name: string
  icon: string
}

export interface GraduationMessageStatus {
  is_delivered: boolean
}

export class PortfolioApi {
  constructor(private http: Http) {}

  private async call<T>(method: "GET" | "POST", path: string, json?: unknown): Promise<T> {
    const res = await this.http.request<T>(method, `${PORT}${path}`, {
      origin: PORT,
      json,
    })
    if (res.status < 200 || res.status >= 300) throw new ClassiError(`portfolio api error: ${path}`, res.status, path, res.data)
    return res.data
  }

  userInfo(): Promise<PortfolioUserInfo> {
    return this.call("GET", "/api/v1/user_info")
  }

  activityRecord(id: number | string): Promise<ActivityRecordDetail> {
    return this.call("GET", `/api/v1/activity_records/${encodeURIComponent(String(id))}`)
  }

  templates(): Promise<{ templates: PortfolioTemplate[] }> {
    return this.call("GET", "/api/v1/templates")
  }

  marks(): Promise<{ marks: PortfolioMark[] }> {
    return this.call("GET", "/api/v2/marks")
  }

  graduationMessageStatus(): Promise<GraduationMessageStatus> {
    return this.call("GET", "/api/v2/student/graduation_messages/delivered_status")
  }

  spaces(page = 1): Promise<StudentSpaces> {
    return this.call("GET", `/api/v1/student/spaces?page=${page}`)
  }

  stories(grade: number): Promise<unknown[]> {
    return this.call("GET", `/api/v2/student/stories?grade=${grade}`)
  }

  storyCategories(): Promise<{ story_categories: StoryCategory[] }> {
    return this.call("GET", "/api/v2/story_categories")
  }

  storyComments(grade: number): Promise<StoryComments> {
    return this.call("GET", `/api/v2/student/story_comments?grade=${grade}`)
  }

  searchActivityRecords(body: Record<string, unknown> = {}): Promise<{ activity_records: ActivityRecord[] }> {
    return this.call("POST", "/api/v1/student/activity_records/myspace_search", body)
  }

  searchWorks(body: Record<string, unknown> = {}): Promise<unknown> {
    return this.call("POST", "/api/v1/student/works/search", body)
  }

  searchAlbums(body: Record<string, unknown> = {}): Promise<unknown> {
    return this.call("POST", "/api/v1/student/albums/search", body)
  }

  categories(): Promise<unknown> {
    return this.call("GET", "/api/v2/categories")
  }

  notificationsBadge(): Promise<unknown> {
    return this.call("GET", "/api/v1/student/notifications/badge_my_space")
  }
}

export interface KarteTestDetailParams {
  name?: string
  exam_date?: string
  national_display_code?: string
  prefecture_display_code?: string
  school_display_code?: string
  gtz_output_flg?: string
}

export interface KarteBenesseExam extends Required<KarteTestDetailParams> {
  id: string
  for_teacher: boolean
}

export interface KarteTestSummary {
  id: string
  kind: number | string
  name: string
  start_on: string
  end_on: string
  date: string
  detail: {
    labels?: unknown[]
    kind?: { id: number; name: string; identifier: string }
    bc_results?: { exam: KarteBenesseExam }
    io_results?: unknown
    answer_paper_metadata?: unknown[]
  }
}

export class KarteApi {
  constructor(private http: Http) {}

  private async call<T>(method: "GET" | "POST", path: string, json?: unknown): Promise<T> {
    const res = await this.http.request<T>(method, `${KARTE}${path}`, {
      origin: KARTE,
      json,
    })
    if (res.status < 200 || res.status >= 300) throw new ClassiError(`karte api error: ${path}`, res.status, path, res.data)
    return res.data
  }

  tests(userId: number | string, kind: number, classroomId?: number | string): Promise<KarteTestSummary[]> {
    const filter = classroomId === undefined ? "" : `&classroom_id=${encodeURIComponent(String(classroomId))}`
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/tests?kind=${kind}${filter}`)
  }

  testDetail(userId: number | string, examId: string, params: KarteTestDetailParams = {}): Promise<unknown> {
    const query = new URLSearchParams()
    for (const key of ["name", "exam_date", "national_display_code", "prefecture_display_code", "school_display_code", "gtz_output_flg"] as const) {
      if (params[key] !== undefined) query.set(key, params[key])
    }
    const suffix = query.toString()
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/tests/${encodeURIComponent(examId)}${suffix ? `?${suffix}` : ""}`)
  }

  trainingBenesseTestUrl(): Promise<{ url: string }> {
    return this.call("GET", "/training_benesse_test_url")
  }

  subjectLearningReports(userId: number | string): Promise<unknown> {
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/subject_learning_reports`)
  }

  pathways(userId: number | string, type = 1, classroomsId?: number | string): Promise<unknown> {
    const filter = classroomsId === undefined ? "" : `&classrooms_id=${encodeURIComponent(String(classroomsId))}`
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/pathways?type=${type}${filter}`)
  }

  questionnaires(userId: number | string, formatType = 1): Promise<unknown> {
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/questionnaires?format_type=${formatType}`)
  }
}
