// Shared types for the server

export type BookmarkStatus = 'pending' | 'downloading' | 'completed' | 'failed'
export type BookmarkMediaKind = 'image' | 'video' | 'gif'
export type BookmarkMediaStatus = 'pending' | 'downloading' | 'completed' | 'failed'

export interface BookmarkMediaItem {
  id: number
  bookmarkId: number
  mediaKind: BookmarkMediaKind
  sourceUrl: string
  sequenceNo: number
  status: BookmarkMediaStatus
  localPath?: string
  errorMessage?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface Bookmark {
  id: number
  tweetId: string
  url: string
  authorId: string
  authorName: string
  authorHandle: string
  text: string
  mediaType: 'none' | 'image' | 'video' | 'gif' | 'mixed'
  mediaUrls: string[]
  mediaPaths: string[]
  mediaDownloadFailed: boolean
  mediaItems?: BookmarkMediaItem[]
  quotedTweetUrl?: string
  status: BookmarkStatus
  bookmarkTime: string
  createdAt: string
  updatedAt: string
}

export interface BookmarkInput {
  tweetId: string
  url: string
  authorId: string
  authorName?: string
  authorHandle?: string
  text?: string
  mediaType?: 'none' | 'image' | 'video' | 'gif' | 'mixed'
  mediaUrls?: string[]
  quotedTweetUrl?: string
  bookmarkTime?: string
  rawHtml?: string
}

export interface MediaDownload {
  id: number
  bookmarkId: number
  originalUrl: string
  localPath?: string
  fileName?: string
  fileSize?: number
  mimeType?: string
  status: 'pending' | 'downloading' | 'completed' | 'failed'
  errorMessage?: string
  retryCount: number
  createdAt: string
  updatedAt: string
}

export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
  message?: string
}
