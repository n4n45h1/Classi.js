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

export interface KarteTestSummary {
  id: string
  kind: number
  name: string
  start_on: string
  end_on: string
  date: string
  detail: { labels: unknown[]; kind: { id: number; name: string; identifier: string } }
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

  tests(userId: number | string, kind: number): Promise<KarteTestSummary[]> {
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/tests?kind=${kind}`)
  }

  testDetail(userId: number | string, examId: string): Promise<unknown> {
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/tests/${encodeURIComponent(examId)}`)
  }

  subjectLearningReports(userId: number | string): Promise<unknown> {
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/subject_learning_reports`)
  }

  pathways(userId: number | string, type = 1): Promise<unknown> {
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/pathways?type=${type}`)
  }

  questionnaires(userId: number | string, formatType = 1): Promise<unknown> {
    return this.call("GET", `/api/users/${encodeURIComponent(String(userId))}/questionnaires?format_type=${formatType}`)
  }
}
