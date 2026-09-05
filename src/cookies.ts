export interface Cookie {
  name: string
  value: string
  domain: string
  path: string
  hostOnly: boolean
  secure: boolean
  expires?: number
}

export class CookieJar {
  private cookies: Cookie[] = []

  static fromJSON(data: Cookie[]): CookieJar {
    const jar = new CookieJar()
    jar.cookies = data.map((c) => ({ ...c }))
    return jar
  }

  toJSON(): Cookie[] {
    this.cleanup()
    return this.cookies.map((c) => ({ ...c }))
  }

  private cleanup(): void {
    const now = Date.now()
    this.cookies = this.cookies.filter((c) => c.expires === undefined || c.expires > now)
  }

  setFromResponse(setCookieHeaders: string[], requestUrl: URL): void {
    for (const line of setCookieHeaders) {
      const parts = line.split(";").map((p) => p.trim())
      const [nv, ...attrs] = parts
      const eq = nv.indexOf("=")
      if (eq === -1) continue
      const name = nv.slice(0, eq).trim()
      const value = nv.slice(eq + 1).trim()
      let domain = requestUrl.hostname
      const lastSlash = requestUrl.pathname.lastIndexOf("/")
      let path = lastSlash > 0 ? requestUrl.pathname.slice(0, lastSlash) : "/"
      let secure = false
      let maxAge: number | undefined
      let expires: number | undefined
      let hostOnly = true
      for (const attr of attrs) {
        const aeq = attr.indexOf("=")
        const an = (aeq === -1 ? attr : attr.slice(0, aeq)).trim().toLowerCase()
        const av = aeq === -1 ? "" : attr.slice(aeq + 1).trim()
        if (an === "domain" && av) {
          domain = av.replace(/^\./, "").toLowerCase()
          hostOnly = false
        } else if (an === "secure") {
          secure = true
        } else if (an === "path" && av.startsWith("/")) {
          path = av
        } else if (an === "expires" && av) {
          const t = Date.parse(av)
          if (!Number.isNaN(t)) expires = t
        } else if (an === "max-age" && av) {
          if (/^-?\d+$/.test(av)) maxAge = Number(av)
        }
      }
      if (!name) continue
      const host = requestUrl.hostname
      if (!hostOnly && host !== domain && !host.endsWith(`.${domain}`)) continue
      if (secure && requestUrl.protocol !== "https:") continue
      if (name.startsWith("__Secure-") && !secure) continue
      if (name.startsWith("__Host-") && (!secure || !hostOnly || path !== "/" ||
        !attrs.some((attr) => /^path=\/$/i.test(attr)))) continue
      // Max-Age takes precedence over Expires regardless of attribute order.
      if (maxAge !== undefined) expires = maxAge <= 0 ? 0 : Date.now() + maxAge * 1000
      this.cookies = this.cookies.filter(
        (c) => !(c.name === name && c.domain === domain && c.path === path)
      )
      if (expires === undefined || expires > Date.now()) {
        this.cookies.push({ name, value, domain, path, hostOnly, secure, expires })
      }
    }
  }

  getHeader(requestUrl: URL): string | undefined {
    this.cleanup()
    const host = requestUrl.hostname
    const matches = this.cookies.filter((c) => {
      if (c.secure && requestUrl.protocol !== "https:") return false
      if (c.hostOnly ? c.domain !== host : !(host === c.domain || host.endsWith(`.${c.domain}`))) return false
      const reqPath = requestUrl.pathname || "/"
      if (reqPath !== c.path &&
        !(reqPath.startsWith(c.path) && (c.path.endsWith("/") || reqPath[c.path.length] === "/"))) return false
      return true
    })
    if (matches.length === 0) return undefined
    return matches.sort((a, b) => b.path.length - a.path.length).map((c) => `${c.name}=${c.value}`).join("; ")
  }
}
