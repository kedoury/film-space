// 视频服务：负责视频的 CRUD、缩略图、流式播放与分享 token 管理

import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import metadataStore from './MetadataStore.js'
import type { VideoMeta } from '@shared/types'

export interface CreateVideoInput {
  name: string
  durationMs: number
  width: number
  height: number
  file: Buffer
  thumbnail: Buffer
}

class VideoService {
  // 创建新视频：写入 .webm + .png，并更新索引
  async createVideo(data: CreateVideoInput): Promise<VideoMeta> {
    const id = uuidv4()
    const now = new Date().toISOString()
    const shareToken = uuidv4()
    const meta: VideoMeta = {
      id,
      name: data.name,
      createdAt: now,
      durationMs: data.durationMs,
      width: data.width,
      height: data.height,
      sizeBytes: data.file.length,
      thumbnailURL: `/api/videos/${id}/thumbnail`,
      fileURL: `/api/videos/${id}/file`,
      shareToken,
    }

    const webmFile = path.join(metadataStore.videosDir, `${id}.webm`)
    const thumbFile = path.join(metadataStore.videosDir, `${id}.png`)
    await fs.promises.writeFile(webmFile, data.file)
    await fs.promises.writeFile(thumbFile, data.thumbnail)

    await metadataStore.addVideo(meta)
    return meta
  }

  async getVideo(id: string): Promise<VideoMeta | null> {
    return metadataStore.getVideo(id)
  }

  async listVideos(): Promise<VideoMeta[]> {
    return metadataStore.listVideos()
  }

  async deleteVideo(id: string): Promise<void> {
    await metadataStore.deleteVideo(id)
  }

  // 解析视频文件路径（不存在返回 null）
  private async resolveFile(id: string): Promise<string | null> {
    const meta = await metadataStore.getVideo(id)
    if (!meta) return null
    const file = path.join(metadataStore.videosDir, `${id}.webm`)
    try {
      await fs.promises.access(file, fs.constants.R_OK)
      return file
    } catch {
      return null
    }
  }

  // 流式返回整个视频文件（用于普通播放）
  async getFileStream(id: string): Promise<fs.ReadStream | null> {
    const file = await this.resolveFile(id)
    if (!file) return null
    return fs.createReadStream(file)
  }

  // 获取文件路径与大小（用于 Range 请求处理）
  async getFileInfo(id: string): Promise<{ path: string; size: number } | null> {
    const file = await this.resolveFile(id)
    if (!file) return null
    const stat = await fs.promises.stat(file)
    return { path: file, size: stat.size }
  }

  // 读取缩略图 Buffer
  async getThumbnail(id: string): Promise<Buffer | null> {
    const meta = await metadataStore.getVideo(id)
    if (!meta) return null
    const file = path.join(metadataStore.videosDir, `${id}.png`)
    try {
      await fs.promises.access(file, fs.constants.R_OK)
      return await fs.promises.readFile(file)
    } catch {
      return null
    }
  }

  // 按 share token 查询视频
  async getShareByToken(token: string): Promise<VideoMeta | null> {
    const result = await metadataStore.findShare(token)
    if (!result || result.type !== 'video') return null
    return result.meta
  }
}

export const videoService = new VideoService()
export default videoService
