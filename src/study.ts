import { Http, ClassiError } from "./http.js"
import type { ClassiUser } from "./types.js"

const STUDY = "https://study.classi.jp/api"

export interface StudyReportForm {
  activityTimeReports: {
    awokeAt: string | null
    schoolAt: string | null
    homeAt: string | null
    workStartedAt: string | null
    sleptAt: string | null
  }
  satisfactionRate: { timeRating: string | null; contentRating: string | null }
  subjectLearning: unknown
}

export interface TargetGtz {
  targetGTZs: string[]
  targetGTZSelected: string | null
}

export class StudyApi {
  constructor(private http: Http) {}

  private async call<T>(method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE", path: string, json?: unknown): Promise<T> {
    const res = await this.http.request<T>(method, `${STUDY}${path}`, {
      origin: "https://study.classi.jp",
      referer: "https://study.classi.jp/",
      json,
    })
    if (res.status < 200 || res.status >= 300) throw new ClassiError(`study api error: ${path}`, res.status, path, res.data)
    return res.data
  }

  currentUser(): Promise<ClassiUser> {
    return this.call<ClassiUser>("GET", "/current_user")
  }

  permittedMonths(): Promise<{ year: number; month: number }[]> {
    return this.call("GET", "/permitted_months")
  }

  studentSettings(): Promise<unknown> {
    return this.call("GET", "/study/student_settings")
  }

  dailyReport(date: string): Promise<unknown> {
    return this.call("GET", `/study/my_report/daily?date=${encodeURIComponent(date)}`)
  }

  reportForm(date: string): Promise<StudyReportForm> {
    return this.call<StudyReportForm>("GET", `/study/my_report/form?date=${encodeURIComponent(date)}`)
  }

  saveReportForm(date: string, form: StudyReportForm): Promise<void> {
    return this.call("PUT", `/study/my_report/form?date=${encodeURIComponent(date)}`, form)
  }

  recordedDates(month: string): Promise<string[]> {
    return this.call("GET", `/study/my_report/recorded_dates?month=${encodeURIComponent(month)}`)
  }

  ranking(kind: "classroom" | "club" | "grade", date: string): Promise<unknown> {
    return this.call("GET", `/study/ranking/${kind}/daily?date=${encodeURIComponent(date)}`)
  }

  targetGtz(): Promise<TargetGtz> {
    return this.call("GET", "/study/target_gtz")
  }

  setTargetGtz(gtzs: string[]): Promise<unknown> {
    return this.call("POST", "/study/target_gtz", { targetGTZSelected: gtzs })
  }

  readFeatureBadge(): Promise<void> {
    return this.call("PUT", "/study/feature_badge/read", {})
  }
}
