import { Http, ClassiError, type SessionData } from "./http.js"
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
}

export class ClassiClient {
  private http: Http
  private credentials?: Credentials

  readonly id: IdApi
  readonly training: TrainingApi
  readonly study: StudyApi
  readonly platform: PlatformApi
  readonly portfolio: PortfolioApi
  readonly karte: KarteApi

  constructor(opts: ClassiClientOptions = {}) {
    this.credentials =
      opts.username && opts.password ? { username: opts.username, password: opts.password } : undefined
    this.http = opts.session
      ? Http.restore(opts.session, { userAgent: opts.userAgent })
      : new Http({ userAgent: opts.userAgent })
    this.id = new IdApi(this.http)
    this.training = new TrainingApi(this.http)
    this.study = new StudyApi(this.http)
    this.platform = new PlatformApi(this.http)
    this.portfolio = new PortfolioApi(this.http)
    this.karte = new KarteApi(this.http)
  }

  async login(): Promise<LoginResult> {
    if (!this.credentials) {
      throw new ClassiError("username and password are required to login", 0, "login", null)
    }
    return this.id.login(this.credentials)
  }

  get session(): SessionData {
    return this.http.save()
  }

  static fromSession(data: SessionData, opts: ClassiClientOptions = {}): ClassiClient {
    return new ClassiClient({ ...opts, session: data })
  }
}
