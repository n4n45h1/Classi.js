import { Http, ClassiError, type SessionData, type HttpOptions } from "./http.js"
import { IdApi } from "./id.js"
import { TrainingApi } from "./training.js"
import { StudyApi } from "./study.js"
import { PlatformApi } from "./platform.js"
import { PortfolioApi, KarteApi } from "./portfolio.js"
import type { LoginResult, Credentials } from "./id.js"

export interface ClassiClientOptions {
  username?: string
  password?: string
  userAgent?: string
  session?: SessionData
  timeoutMs?: number
  fetch?: typeof globalThis.fetch
}

export type ClassiService = "training" | "study" | "platform" | "portfolio" | "karte"
export type ClassiQueryValue = string | number | boolean | null | undefined

const SERVICE_CONFIG: Record<ClassiService, { base: string; origin: string; referer?: string }> = {
  training: { base: "https://training-api.classi.jp/api", origin: "https://training.classi.jp", referer: "https://training.classi.jp/student/" },
  study: { base: "https://study.classi.jp/api", origin: "https://study.classi.jp" },
  platform: { base: "https://platform.classi.jp", origin: "https://platform.classi.jp" },
  portfolio: { base: "https://portfolio.classi.jp", origin: "https://portfolio.classi.jp" },
  karte: { base: "https://karte.classi.jp", origin: "https://karte.classi.jp" },
}

export class ClassiClient {
  private http: Http
  private credentials?: Credentials
  private loginPromise?: Promise<LoginResult>

  readonly id: IdApi
  readonly training: TrainingApi
  readonly study: StudyApi
  readonly platform: PlatformApi
  readonly portfolio: PortfolioApi
  readonly karte: KarteApi

  constructor(opts: ClassiClientOptions = {}) {
    this.credentials =
      opts.username && opts.password ? { username: opts.username, password: opts.password } : undefined
    const httpOptions: HttpOptions = { userAgent: opts.userAgent, timeoutMs: opts.timeoutMs, fetch: opts.fetch }
    this.http = opts.session ? Http.restore(opts.session, httpOptions) : new Http(httpOptions)
    this.id = new IdApi(this.http)
    this.training = new TrainingApi(this.http)
    this.study = new StudyApi(this.http)
    this.platform = new PlatformApi(this.http)
    this.portfolio = new PortfolioApi(this.http)
    this.karte = new KarteApi(this.http)
    if (this.credentials) {
      this.http.setAuthRecovery(async () => {
        const { status } = await this.login()
        if (Object.values(status).some(Boolean)) {
          throw new ClassiError("additional login steps are required", 401, "login/continue", status)
        }
      })
    }
  }

  async login(): Promise<LoginResult> {
    if (!this.credentials) {
      throw new ClassiError("username and password are required to login", 0, "login", null)
    }
    if (!this.loginPromise) {
      const attempt = this.id.login(this.credentials).then((result) => {
        this.http.csrfTokens = {}
        return result
      })
      this.loginPromise = attempt
      void attempt.finally(() => {
        if (this.loginPromise === attempt) this.loginPromise = undefined
      }).catch(() => {})
    }
    return this.loginPromise
  }

  get session(): SessionData {
    return this.http.save()
  }

  clearSession(): void {
    this.http.jar.clear()
    this.http.csrfTokens = {}
  }

  /**
   * Read a known Classi endpoint not yet covered by the typed API.
   * This is deliberately GET-only; T is a caller assertion, not runtime validation.
   */
  async get<T = unknown>(service: ClassiService, path: string, query: Record<string, ClassiQueryValue> = {}): Promise<T> {
    const config = SERVICE_CONFIG[service]
    if (!config) throw new TypeError("unknown Classi service: " + service)
    if (!path.startsWith("/") || path.startsWith("//") || path.includes("\\") || path.includes("#")) {
      throw new TypeError("path must be a service-relative absolute path")
    }
    const rawPath = path.split("?")[0]
    if (rawPath.split("/").some((segment) => {
      try { return [".", ".."].includes(decodeURIComponent(segment)) } catch { return true }
    })) throw new TypeError("relative path segments are not allowed")
    const url = new URL(config.base + path)
    const base = new URL(config.base)
    if (url.origin !== base.origin ||
      !(url.pathname === base.pathname || url.pathname.startsWith(base.pathname === "/" ? "/" : base.pathname + "/"))) {
      throw new TypeError("path escapes the service API base")
    }
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined && value !== null) url.searchParams.set(key, String(value))
    }
    const res = await this.http.request<T>("GET", url.href, { origin: config.origin, referer: config.referer })
    if (res.status < 200 || res.status >= 300) {
      throw new ClassiError("Classi " + service + " GET failed", res.status, url.origin + url.pathname, res.data)
    }
    return res.data
  }

  static fromSession(data: SessionData, opts: ClassiClientOptions = {}): ClassiClient {
    return new ClassiClient({ ...opts, session: data })
  }
}
