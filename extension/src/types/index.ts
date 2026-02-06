// Shared types for the extension

export interface TweetData {
  tweetId: string
  url: string
  authorId: string
  authorName: string
  authorHandle: string
  text: string
  mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'
  mediaUrls: string[]
  quotedTweetUrl?: string
  bookmarkTime: string
  rawHtml?: string
}

export interface Settings {
  serverUrl: string
  enabled: boolean
}

export enum MessageType {
  BOOKMARK_ADDED = 'BOOKMARK_ADDED',
  GET_SETTINGS = 'GET_SETTINGS',
  SAVE_SETTINGS = 'SAVE_SETTINGS',
}

export interface Message {
  type: MessageType
  data?: TweetData | Settings
}
