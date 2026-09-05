import { CookieJar } from "./cookies.js"

export class ClassiError extends Error {
  status: number
  body: unknown
  endpoint: string

  constructor(message: string, status: number, endpoint: string, body: unknown) {
    super(message)
    this.name = "ClassiError"
    this.status = status
    this.endpoint = endpoint
    this.body = body
  }
}

export interface SessionData {
  cookies: ReturnType<CookieJar["toJSON"]>
  csrfTokens: Record<string, string>
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export class Http {
  jar: CookieJar
  csrfTokens: Record<string, string> = {}
  userAgent: string

  constructor(opts?: { cookies?: CookieJar; userAgent?: string }) {
    this.jar = opts?.cookies ?? new CookieJar()
    this.userAgent =
      opts?.userAgent ??
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"
  }

  save(): SessionData {
    return { cookies: this.jar.toJSON(), csrfTokens: { ...this.csrfTokens } }
  }

  static restore(data: SessionData, opts?: { userAgent?: string }): Http {
    const h = new Http({ cookies: CookieJar.fromJSON(data.cookies), userAgent: opts?.userAgent })
    h.csrfTokens = { ...data.csrfTokens }
    return h
  }

  async request<T = unknown>(
    method: Method,
    url: string,
    opts: {
      origin?: string
      referer?: string
      csrfToken?: string
      json?: unknown
      form?: Record<string, string>
      raw?: boolean
      csrf?: boolean
    } = {}
  ): Promise<{ status: number; data: T; headers: Headers }> {
    const target = new URL(url)
    const headers: Record<string, string> = {
      "User-Agent": this.userAgent,
      Accept: "application/json, text/plain, */*",
      "Accept-Language": "ja,en;q=0.9",
    }
    if (opts.origin) {
      headers["Origin"] = opts.origin
      headers["Referer"] = opts.referer ?? opts.origin + "/"
    } else if (opts.referer) {
      headers["Referer"] = opts.referer
    }
    if (opts.csrf && opts.csrfToken) headers["X-CSRF-Token"] = opts.csrfToken
    let body: string | undefined
    if (opts.json !== undefined) {
      body = JSON.stringify(opts.json)
      headers["Content-Type"] = "application/json"
    } else if (opts.form) {
      body = new URLSearchParams(opts.form).toString()
      headers["Content-Type"] = "application/x-www-form-urlencoded"
    }
    const cookie = this.jar.getHeader(target)
    if (cookie) headers["Cookie"] = cookie

    const res = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
    })
    const setCookies = res.headers.getSetCookie?.() ??
      (res.headers.get("set-cookie")?.split(/,(?=\s*[^;,\s=]+=)/) ?? [])
    if (setCookies.length) this.jar.setFromResponse(setCookies, target)

    if (opts.raw) {
      return { status: res.status, data: (await res.arrayBuffer()) as unknown as T, headers: res.headers }
    }
    const text = await res.text()
    let data: unknown = text
    if (text.trim()) {
      try {
        data = JSON.parse(text)
      } catch {
        /* keep raw text */
      }
    }
    return { status: res.status, data: data as T, headers: res.headers }
  }
}
