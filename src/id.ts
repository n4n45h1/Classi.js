import { Http, ClassiError } from "./http.js"
import type { IdApiStatus, LoginContinueStatus, LoginMethod } from "./types.js"

const ID = "https://id.classi.jp"
const IDAPI = "https://id-api.classi.jp/api/v1"

export interface Credentials {
  username: string
  password: string
}

export interface LoginResult {
  status: LoginContinueStatus
}

export class IdApi {
  constructor(private http: Http) {}

  private async csrf(): Promise<string> {
    const { data } = await this.http.request<{ success: boolean; data: string }>("GET", `${IDAPI}/csrf_token`, {
      origin: ID,
    })
    if (!data || typeof data.data !== "string") {
      throw new ClassiError("failed to obtain id csrf token", 0, `${IDAPI}/csrf_token`, data)
    }
    return data.data
  }

  async loginMethods(username: string): Promise<LoginMethod[]> {
    const token = await this.csrf()
    const res = await this.http.request<{ success: boolean; data: LoginMethod[] }>(
      "POST",
      `${IDAPI}/login_methods`,
      { origin: ID, csrf: true, csrfToken: token, json: { username } }
    )
    if (res.status >= 400 || !res.data?.success || !Array.isArray(res.data.data)) {
      throw new ClassiError("failed to fetch login methods", res.status, `${IDAPI}/login_methods`, res.data)
    }
    return res.data.data
  }

  async login({ username, password, saveId = false }: Credentials & { saveId?: boolean }): Promise<LoginResult> {
    await this.http.request("GET", `${ID}/`, { origin: ID })
    const token = await this.csrf()

    const methods = await this.loginMethods(username)
    if (!methods.some((m) => m.name === "password")) {
      throw new ClassiError("password login is not available for this account", 0, `${IDAPI}/login_methods`, methods)
    }

    const res = await this.http.request<{ success: boolean }>("POST", `${IDAPI}/login/with_password`, {
      origin: ID,
      csrf: true,
      csrfToken: token,
      json: { username, password, saveId },
    })
    if (!res.data?.success) {
      throw new ClassiError("invalid username or password", res.status, `${IDAPI}/login/with_password`, res.data)
    }

    const cont = await this.http.request<{ success: boolean; data: LoginContinueStatus }>(
      "GET",
      `${IDAPI}/login/continue`,
      { origin: ID }
    )

    const token2 = await this.csrf()
    const issued = await this.http.request<{ success: boolean }>("POST", `${IDAPI}/login/issue_cookie`, {
      origin: ID,
      csrf: true,
      csrfToken: token2,
      json: {},
    })
    if (!issued.data?.success) {
      throw new ClassiError("failed to issue session cookies", issued.status, `${IDAPI}/login/issue_cookie`, issued.data)
    }
    return { status: cont.data?.data as LoginContinueStatus }
  }

  async myStatuses(): Promise<IdApiStatus> {
    const res = await this.http.request<{ success: boolean; data: IdApiStatus }>(
      "GET",
      `${IDAPI}/my/statuses`,
      { origin: ID }
    )
    if (res.status >= 400 || !res.data?.success || !res.data?.data) {
      throw new ClassiError("failed to fetch account statuses", res.status, `${IDAPI}/my/statuses`, res.data)
    }
    return res.data.data
  }

  async changeUsername(currentPassword: string, newUsername: string): Promise<void> {
    const sudo = await this.http.request<{ success: boolean }>("POST", `${IDAPI}/my/session/sudo`, {
      origin: ID,
      csrf: true,
      csrfToken: await this.csrf(),
      json: { password: currentPassword },
    })
    if (!sudo.data?.success) {
      throw new ClassiError("sudo re-authentication failed", sudo.status, `${IDAPI}/my/session/sudo`, sudo.data)
    }
    const res = await this.http.request("PUT", `${IDAPI}/my/username`, {
      origin: ID,
      csrf: true,
      csrfToken: await this.csrf(),
      json: { username: newUsername },
    })
    if (res.status >= 400) {
      throw new ClassiError("failed to change username", res.status, `${IDAPI}/my/username`, res.data)
    }
  }
}
