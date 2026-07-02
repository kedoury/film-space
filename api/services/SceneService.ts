// 场景服务：负责场景的 CRUD 与缩略图、分享 token 管理

import fs from 'fs'
import path from 'path'
import { v4 as uuidv4 } from 'uuid'
import metadataStore from './MetadataStore.js'
import type { SceneMeta, SceneState, OrbitCameraPose } from '@shared/types'

export interface CreateSceneInput {
  name: string
  state: SceneState
  cameraPose: OrbitCameraPose
  thumbnail: Buffer
}

class SceneService {
  // 创建新场景：写入 .json + .png，并更新索引
  async createScene(data: CreateSceneInput): Promise<SceneMeta> {
    const id = uuidv4()
    const now = new Date().toISOString()
    const shareToken = uuidv4()
    const meta: SceneMeta = {
      id,
      name: data.name,
      createdAt: now,
      updatedAt: now,
      thumbnailURL: `/api/scenes/${id}/thumbnail`,
      state: data.state,
      cameraPose: data.cameraPose,
      shareToken,
    }

    const stateFile = path.join(metadataStore.scenesDir, `${id}.json`)
    const thumbFile = path.join(metadataStore.scenesDir, `${id}.png`)
    // state + cameraPose 一起写入 JSON 文件
    await fs.promises.writeFile(
      stateFile,
      JSON.stringify({ state: data.state, cameraPose: data.cameraPose }, null, 2),
      'utf-8',
    )
    await fs.promises.writeFile(thumbFile, data.thumbnail)

    await metadataStore.addScene(meta)
    return meta
  }

  async getScene(id: string): Promise<SceneMeta | null> {
    return metadataStore.getScene(id)
  }

  async listScenes(): Promise<SceneMeta[]> {
    return metadataStore.listScenes()
  }

  async deleteScene(id: string): Promise<void> {
    await metadataStore.deleteScene(id)
  }

  // 读取缩略图 Buffer
  async getThumbnail(id: string): Promise<Buffer | null> {
    const meta = await metadataStore.getScene(id)
    if (!meta) return null
    const file = path.join(metadataStore.scenesDir, `${id}.png`)
    try {
      await fs.promises.access(file, fs.constants.R_OK)
      return await fs.promises.readFile(file)
    } catch {
      return null
    }
  }

  // 按 share token 查询场景
  async getShareByToken(token: string): Promise<SceneMeta | null> {
    const result = await metadataStore.findShare(token)
    if (!result || result.type !== 'scene') return null
    return result.meta
  }
}

export const sceneService = new SceneService()
export default sceneService
