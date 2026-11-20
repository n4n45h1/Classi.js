import { Http, ClassiError } from "./http.js"

const PLAT = "https://platform.classi.jp"

export interface PlatformUserInfo {
  user: { id: number; icon: string; name: string; type: number; language: string; fullname: string }
  school: { id: number; benesse_school_id: string; name: string; [k: string]: unknown }
}

export interface NotificationItem {
  id: number
  title?: string
  body?: string
  [k: string]: unknown
}

export interface GroupSummary {
  id: number
  name: string
  color: number
  unread: number
  is_favorited: boolean
  group_type: number
  sort_no: number | null
}

export interface GroupDetail extends Omit<GroupSummary, "unread" | "sort_no"> {
  description: string
  edit_only: boolean
  message_restricted: boolean
  comment_restricted: boolean
  like_restricted: boolean
  group_message_restricted: boolean
  group_comment_restricted: boolean
  group_like_restricted: boolean
  member_count: { total: number; teacher: number; inaccessible: number; deleted: number; student: number }
}

export interface GroupMessages {
  group: GroupDetail
  messages: unknown[]
  [k: string]: unknown
}

export interface WebtestExaminations {
  total: number
  page: number
  distributions: unknown[]
}

export interface CbankUsage {
  for_group: number
  for_webtest: number
  for_questionnaire: number
  for_talkroom: number
  for_studentcards: number
  for_userconfig: number
  for_officialdocs: number
  for_others: number
  total: number
}

export interface CbankStat {
  mine: CbankUsage & { limit: number }
  school: CbankUsage & { limit: number }
  guardians: CbankUsage
  max_upload_size: number
}

export interface GroupYear {
  year_id: number
  year_name: string
}

export interface SubjectList {
  subject_categories: Record<string, {
    id: string
    name: string
    order: string
    school_ages_id: string
    subjects: Record<string, { id: string; name: string; order: string }>
  }>
}

export interface SchoolageList {
  school_ages: Record<string, {
    name: string
    order: string
    difficulties: Record<string, { name: string; short_name: string; order: string }>
  }>
}

export type QuestionnaireCategories = Record<string, { id: number; name: string; order: number }>

export class PlatformApi {
  constructor(private http: Http) {}

  private async call<T>(method: "GET" | "POST" | "PUT" | "DELETE", path: string, json?: unknown): Promise<T> {
    const res = await this.http.request<T>(method, `${PLAT}${path}`, {
      origin: PLAT,
      json,
    })
    if (res.status < 200 || res.status >= 300) throw new ClassiError(`platform api error: ${path}`, res.status, path, res.data)
    return res.data
  }

  userInfo(): Promise<PlatformUserInfo> {
    return this.call("GET", "/api/user/info")
  }

  communicationUser(): Promise<unknown> {
    return this.call("GET", "/communication/api/v1/user")
  }

  home(): Promise<unknown> {
    return this.call("GET", "/communication/api/v1/home")
  }

  analyticsUser(): Promise<unknown> {
    return this.call("GET", "/communication/api/v1/analytics/user")
  }

  notifications(
    kind: "classi" | "school" | "service",
    limit = 20,
    offset = 0
  ): Promise<{ count: number; items: NotificationItem[] }> {
    return this.call("GET", `/communication/api/v1/notification/${kind}?limit=${limit}&offset=${offset}`)
  }

  unreadCount(): Promise<{ count: number }> {
    return this.call("GET", "/communication/api/v1/notification/service/unreadcount")
  }

  markAllServiceNotificationsRead(): Promise<unknown> {
    return this.call("POST", "/communication/api/v1/notification/service/allread", {})
  }

  groups(): Promise<{ groups: GroupSummary[] }> {
    return this.call("GET", "/api/v2/groups/")
  }

  groupMessages(groupId: number, page = 1): Promise<GroupMessages> {
    return this.call("GET", `/api/v2/groups/${groupId}/messages?page=${page}`)
  }

  newMessages(): Promise<unknown[]> {
    return this.call("GET", "/api/v2/groups/newmessages")
  }

  groupActivities(): Promise<unknown[]> {
    return this.call("GET", "/api/v2/groups/activities")
  }

  addBookmark(messageId: string): Promise<unknown> {
    return this.call("POST", "/api/v2/groups/bookmarks", { message_id: messageId })
  }

  removeBookmark(messageId: string): Promise<unknown> {
    return this.call("DELETE", `/api/v2/groups/bookmarks?message_id=${encodeURIComponent(messageId)}`)
  }

  markSeen(messageId: string): Promise<unknown> {
    return this.call("POST", `/api/v3/group_messages/${encodeURIComponent(messageId)}/mimashita`)
  }

  unmarkSeen(messageId: string): Promise<unknown> {
    return this.call("DELETE", `/api/v3/group_messages/${encodeURIComponent(messageId)}/mimashita`)
  }

  taskList(p0 = 0, p1 = 0, p2 = 0, limit = 20): Promise<unknown> {
    return this.call("GET", `/api/task/list/${p0}/${p1}/${p2}/${limit}`)
  }

  calendarEvents(startAt: string, endAt: string, eventType?: string): Promise<unknown> {
    const filter = eventType === undefined ? "" : `&event_type=${encodeURIComponent(eventType)}`
    return this.call("GET", `/api/event/list?start_at=${encodeURIComponent(startAt)}&end_at=${encodeURIComponent(endAt)}${filter}`)
  }

  webtestExaminations(page = 1): Promise<WebtestExaminations> {
    return this.call("GET", `/api/v2/webtest/examinations?page=${page}`)
  }

  webtestResults(page = 1): Promise<WebtestExaminations> {
    return this.call("GET", `/api/v2/webtest/examinations/results?page=${page}`)
  }

  searchTalkrooms(): Promise<unknown[]> {
    return this.call("POST", "/api/v3/talkrooms/search")
  }

  cbankStat(): Promise<CbankStat> {
    return this.call("GET", "/api/cbank/stat")
  }

  groupYears(displayThisYear = true): Promise<GroupYear[]> {
    return this.call("GET", `/api/v2/groups/years?display_this_year=${Number(displayThisYear)}`)
  }

  subjectList(): Promise<SubjectList> {
    return this.call("GET", "/api/subject/list")
  }

  schoolageList(): Promise<SchoolageList> {
    return this.call("GET", "/api/schoolage/list")
  }

  questionnaireCategories(): Promise<QuestionnaireCategories> {
    return this.call("GET", "/api/questionnaire/categories")
  }

  cbankList(page = 1): Promise<unknown> {
    return this.call("GET", `/api/cbank/list?direction=desc&page=${page}&sort=created_at&type=`)
  }
}
