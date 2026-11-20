import { Http, ClassiError } from "./http.js"

const ENDPOINT = "https://kuroko.classi.jp/public/graphql"

export type VideoCategory = "CATEGORY_DAIGAKU_NYUSHI" | "CATEGORY_KOUMUIN_SHIKEN" | "CATEGORY_OTHER"

export interface VideoSummary {
  id: string
  title: string
  __typename: string
}

export interface VideosByCategory {
  pageInfo: { hasNextPage: boolean; endCursor: string | null; __typename: string }
  totalCount: number
  nodes: VideoSummary[]
  __typename: string
}

export interface VideoDetail extends VideoSummary {
  durationSeconds: number
  expiringEmbedding: { playerURL: string; expiresAtEpoch: number; __typename: string }
}

const VIDEOS = `query VideosByCategory($videoCategorty: VideoCategory!, $first: Int!, $after: String) {
  videosByCategory(videoCategory: $videoCategorty, first: $first, after: $after) {
    pageInfo { hasNextPage endCursor __typename }
    totalCount
    nodes {
      ... on DaigakuNyushiVideo { id title __typename }
      ... on KoumuinShikenVideo { id title __typename }
      ... on OtherVideo { id title __typename }
      __typename
    }
    __typename
  }
}`

const VIDEO = `query Video($videoId: String!, $expireInSeconds: Int!) {
  video(videoID: $videoId) {
    __typename
    ... on VideoEssential {
      id title durationSeconds
      expiringEmbedding(expireInSeconds: $expireInSeconds) { playerURL expiresAtEpoch __typename }
    }
  }
}`

export class VideoApi {
  constructor(private http: Http) {}

  private async query<T>(operationName: string, query: string, variables: Record<string, unknown>): Promise<T> {
    const res = await this.http.request<{ data?: T; errors?: unknown[] }>("POST", ENDPOINT, {
      origin: "https://training.classi.jp",
      json: { operationName, query, variables },
    })
    if (res.status < 200 || res.status >= 300 || res.data?.errors?.length || !res.data?.data) {
      throw new ClassiError(`video api error: ${operationName}`, res.status, ENDPOINT, res.data)
    }
    return res.data.data
  }

  async videosByCategory(category: VideoCategory, first = 100, after: string | null = null): Promise<VideosByCategory> {
    const data = await this.query<{ videosByCategory: VideosByCategory }>("VideosByCategory", VIDEOS, {
      videoCategorty: category, first, after,
    })
    return data.videosByCategory
  }

  async video(videoId: string, expireInSeconds = 300): Promise<VideoDetail | null> {
    const data = await this.query<{ video: VideoDetail | null }>("Video", VIDEO, { videoId, expireInSeconds })
    return data.video
  }
}
