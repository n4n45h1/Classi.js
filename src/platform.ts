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

export interface GroupMessages {
  group: GroupSummary & { description: string; [k: string]: unknown }
  messages: unknown[]
  [k: string]: unknown
}

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

  calendarEvents(startAt: string, endAt: string): Promise<unknown> {
    return this.call("GET", `/api/event/list?start_at=${encodeURIComponent(startAt)}&end_at=${encodeURIComponent(endAt)}`)
  }

  cbankList(page = 1): Promise<unknown> {
    return this.call("GET", `/api/cbank/list?direction=desc&page=${page}&sort=created_at&type=`)
  }
}
