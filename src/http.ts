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

export class ClassiNetworkError extends ClassiError {
  constructor(endpoint: string, cause: unknown) {
    super("Classi network request failed", 0, endpoint, null)
    this.name = "ClassiNetworkError"
    this.cause = cause
  }
}

export class ClassiTimeoutError extends ClassiError {
  constructor(endpoint: string) {
    super("Classi request timed out", 0, endpoint, null)
    this.name = "ClassiTimeoutError"
  }
}

export interface SessionData {
  cookies: ReturnType<CookieJar["toJSON"]>
  csrfTokens: Record<string, string>
}

export type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"

export interface HttpOptions {
  cookies?: CookieJar
  userAgent?: string
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
}

export interface RequestOptions {
  origin?: string
  referer?: string
  csrfToken?: string
  json?: unknown
  form?: Record<string, string>
  raw?: boolean
  csrf?: boolean
  signal?: AbortSignal
  timeoutMs?: number
  retryAuth?: boolean
}

function isAuthRedirect(res: { status: number; headers: Headers }, requestUrl: URL): boolean {
  if (![301, 302, 303, 307, 308].includes(res.status)) return false
  const location = res.headers.get("location")
  if (!location) return false
  try {
    const target = new URL(location, requestUrl)
    return target.protocol === "https:" && target.hostname === "id.classi.jp"
  } catch { return false }
}

export class Http {
  jar: CookieJar
  csrfTokens: Record<string, string> = {}
  userAgent: string
  private readonly timeoutMs: number
  private readonly fetcher: typeof globalThis.fetch
  private recovery?: () => Promise<void>
  private recoveryPromise?: Promise<void>
  private recoveryGeneration = 0

  constructor(opts: HttpOptions = {}) {
    this.jar = opts.cookies ?? new CookieJar()
    this.userAgent = opts.userAgent ??
      "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Mobile Safari/537.36"
    this.timeoutMs = opts.timeoutMs ?? 15_000
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new RangeError("timeoutMs must be a positive finite number")
    }
    this.fetcher = opts.fetch ?? globalThis.fetch
  }

  setAuthRecovery(recovery?: () => Promise<void>): void {
    this.recovery = recovery
  }

  save(): SessionData {
    return { cookies: this.jar.toJSON(), csrfTokens: { ...this.csrfTokens } }
  }

  static restore(data: SessionData, opts: Omit<HttpOptions, "cookies"> = {}): Http {
    if (!data || !Array.isArray(data.cookies) || !data.csrfTokens ||
      typeof data.csrfTokens !== "object" || Array.isArray(data.csrfTokens) ||
      Object.values(data.csrfTokens).some((v) => typeof v !== "string")) {
      throw new TypeError("invalid Classi session")
    }
    const h = new Http({ ...opts, cookies: CookieJar.fromJSON(data.cookies) })
    h.csrfTokens = { ...data.csrfTokens }
    return h
  }

  private async recoverOnce(): Promise<void> {
    if (!this.recovery) return
    if (!this.recoveryPromise) {
      const work = this.recovery()
      this.recoveryPromise = work
      try {
        await work
        this.recoveryGeneration++
      } finally {
        this.recoveryPromise = undefined
      }
    } else {
      await this.recoveryPromise
    }
  }

  private async send<T>(method: Method, target: URL, opts: RequestOptions): Promise<{ status: number; data: T; headers: Headers }> {
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

    const controller = new AbortController()
    const timeoutMs = opts.timeoutMs ?? this.timeoutMs
    if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
      throw new RangeError("timeoutMs must be a positive finite number")
    }
    let timedOut = false
    const timer = setTimeout(() => { timedOut = true; controller.abort() }, timeoutMs)
    const abort = () => controller.abort(opts.signal?.reason)
    if (opts.signal?.aborted) abort()
    else opts.signal?.addEventListener("abort", abort, { once: true })

    try {
      const res = await this.fetcher(target, { method, headers, body, redirect: "manual", signal: controller.signal })
      const setCookies = res.headers.getSetCookie?.() ??
        (res.headers.get("set-cookie")?.split(/,(?=\s*[^;,\s=]+=)/) ?? [])
      if (setCookies.length) this.jar.setFromResponse(setCookies, target)
      if (opts.raw) {
        return { status: res.status, data: (await res.arrayBuffer()) as T, headers: res.headers }
      }
      const text = await res.text()
      let data: unknown = text
      if (text.trim()) {
        try { data = JSON.parse(text) } catch { /* non-JSON response */ }
      }
      return { status: res.status, data: data as T, headers: res.headers }
    } catch (error) {
      if (timedOut) throw new ClassiTimeoutError(target.origin + target.pathname)
      if (opts.signal?.aborted) throw error
      throw new ClassiNetworkError(target.origin + target.pathname, error)
    } finally {
      clearTimeout(timer)
      opts.signal?.removeEventListener("abort", abort)
    }
  }

  async request<T = unknown>(method: Method, url: string, opts: RequestOptions = {}): Promise<{ status: number; data: T; headers: Headers }> {
    const target = new URL(url)
    const generation = this.recoveryGeneration
    let res = await this.send<T>(method, target, opts)
    const mayRecover = method === "GET" && opts.retryAuth !== false && !!this.recovery &&
      !["id.classi.jp", "id-api.classi.jp"].includes(target.hostname)
    if (mayRecover && (res.status === 401 || isAuthRedirect(res, target))) {
      if (generation === this.recoveryGeneration) await this.recoverOnce()
      res = await this.send<T>(method, target, { ...opts, retryAuth: false })
    }
    return res
  }
}
