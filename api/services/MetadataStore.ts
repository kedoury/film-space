// 元数据索引存储：单例类，管理 /data/metadata.json
// 用 async-mutex 保证并发安全

import fs from 'fs'
import path from 'path'
import { Mutex } from 'async-mutex'
import type { SceneMeta, VideoMeta } from '@shared/types'

interface MetadataShape {
  scenes: SceneMeta[]
  videos: VideoMeta[]
}

// 解析数据卷根目录：优先读 VOLUME_PATH；否则开发环境用 ./data，生产用 /data
function resolveVolumePath(): string {
  if (process.env.VOLUME_PATH) return process.env.VOLUME_PATH
  return process.env.NODE_ENV === 'production' ? '/data' : './data'
}

class MetadataStore {
  private static instance: MetadataStore
  private mutex = new Mutex()
  private data: MetadataShape = { scenes: [], videos: [] }
  private loaded = false
  readonly volumePath: string
  readonly scenesDir: string
  readonly videosDir: string
  readonly metadataFile: string

  private constructor() {
    this.volumePath = resolveVolumePath()
    this.scenesDir = path.join(this.volumePath, 'scenes')
    this.videosDir = path.join(this.volumePath, 'videos')
    this.metadataFile = path.join(this.volumePath, 'metadata.json')
    this.ensureDirs()
  }

  static getInstance(): MetadataStore {
    if (!MetadataStore.instance) {
      MetadataStore.instance = new MetadataStore()
    }
    return MetadataStore.instance
  }

  // 初始化目录结构
  private ensureDirs(): void {
    fs.mkdirSync(this.volumePath, { recursive: true })
    fs.mkdirSync(this.scenesDir, { recursive: true })
    fs.mkdirSync(this.videosDir, { recursive: true })
  }

  // 持久化到磁盘（调用方需已持有锁）
  private async persist(): Promise<void> {
    const tmp = this.metadataFile + '.tmp'
    await fs.promises.writeFile(tmp, JSON.stringify(this.data, null, 2), 'utf-8')
    await fs.promises.rename(tmp, this.metadataFile)
  }

  // 加载索引文件，不存在则创建空结构
  async load(): Promise<void> {
    if (this.loaded) return
    await this.mutex.runExclusive(async () => {
      if (this.loaded) return
      try {
        if (fs.existsSync(this.metadataFile)) {
          const raw = await fs.promises.readFile(this.metadataFile, 'utf-8')
          const parsed = JSON.parse(raw) as MetadataShape
          this.data = {
            scenes: Array.isArray(parsed.scenes) ? parsed.scenes : [],
            videos: Array.isArray(parsed.videos) ? parsed.videos : [],
          }
        } else {
          this.data = { scenes: [], videos: [] }
          await this.persist()
        }
        this.loaded = true
      } catch (err) {
        console.error('[MetadataStore] load failed:', err)
        this.data = { scenes: [], videos: [] }
        this.loaded = true
      }
    })
  }

  async save(): Promise<void> {
    await this.mutex.runExclusive(async () => {
      await this.persist()
    })
  }

  // === 场景相关 ===
  async listScenes(): Promise<SceneMeta[]> {
    await this.load()
    return this.mutex.runExclusive(() => [...this.data.scenes])
  }

  async getScene(id: string): Promise<SceneMeta | null> {
    await this.load()
    return this.mutex.runExclusive(() => {
      const s = this.data.scenes.find((x) => x.id === id)
      return s ? { ...s } : null
    })
  }

  async addScene(meta: SceneMeta): Promise<SceneMeta> {
    await this.load()
    return this.mutex.runExclusive(async () => {
      this.data.scenes.push(meta)
      await this.persist()
      return { ...meta }
    })
  }

  async updateScene(id: string, patch: Partial<SceneMeta>): Promise<SceneMeta | null> {
    await this.load()
    return this.mutex.runExclusive(async () => {
      const idx = this.data.scenes.findIndex((x) => x.id === id)
      if (idx < 0) return null
      const updated: SceneMeta = {
        ...this.data.scenes[idx],
        ...patch,
        id, // 不可变
        updatedAt: new Date().toISOString(),
      }
      this.data.scenes[idx] = updated
      await this.persist()
      return { ...updated }
    })
  }

  async deleteScene(id: string): Promise<SceneMeta | null> {
    await this.load()
    return this.mutex.runExclusive(async () => {
      const idx = this.data.scenes.findIndex((x) => x.id === id)
      if (idx < 0) return null
      const [removed] = this.data.scenes.splice(idx, 1)
      await this.persist()
      // 同步删除关联文件
      this.removeFileIfExists(path.join(this.scenesDir, `${id}.json`))
      this.removeFileIfExists(path.join(this.scenesDir, `${id}.png`))
      return removed
    })
  }

  // === 视频相关 ===
  async listVideos(): Promise<VideoMeta[]> {
    await this.load()
    return this.mutex.runExclusive(() => [...this.data.videos])
  }

  async getVideo(id: string): Promise<VideoMeta | null> {
    await this.load()
    return this.mutex.runExclusive(() => {
      const v = this.data.videos.find((x) => x.id === id)
      return v ? { ...v } : null
    })
  }

  async addVideo(meta: VideoMeta): Promise<VideoMeta> {
    await this.load()
    return this.mutex.runExclusive(async () => {
      this.data.videos.push(meta)
      await this.persist()
      return { ...meta }
    })
  }

  async deleteVideo(id: string): Promise<VideoMeta | null> {
    await this.load()
    return this.mutex.runExclusive(async () => {
      const idx = this.data.videos.findIndex((x) => x.id === id)
      if (idx < 0) return null
      const [removed] = this.data.videos.splice(idx, 1)
      await this.persist()
      this.removeFileIfExists(path.join(this.videosDir, `${id}.webm`))
      this.removeFileIfExists(path.join(this.videosDir, `${id}.png`))
      return removed
    })
  }

  // === 分享 token 查询 ===
  async findShare(token: string): Promise<
    { type: 'scene'; meta: SceneMeta } | { type: 'video'; meta: VideoMeta } | null
  > {
    await this.load()
    return this.mutex.runExclusive(() => {
      const scene = this.data.scenes.find((x) => x.shareToken === token)
      if (scene) return { type: 'scene', meta: { ...scene } }
      const video = this.data.videos.find((x) => x.shareToken === token)
      if (video) return { type: 'video', meta: { ...video } }
      return null
    })
  }

  private removeFileIfExists(p: string): void {
    try {
      if (fs.existsSync(p)) fs.unlinkSync(p)
    } catch (err) {
      console.warn(`[MetadataStore] failed to remove file ${p}:`, err)
    }
  }
}

export const metadataStore = MetadataStore.getInstance()
export default metadataStore
