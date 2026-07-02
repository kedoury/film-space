// 场景路由：场景的 CRUD 与缩略图访问

import { Router, type Request, type Response, type NextFunction } from 'express'
import sceneService from '../services/SceneService.js'
import { sceneUpload } from '../middleware/upload.js'
import type { SceneState, OrbitCameraPose } from '@shared/types'

const router = Router()

// 工具：安全解析可能是 JSON 字符串的字段
function parseMaybeJSON<T>(value: unknown): T {
  if (typeof value === 'string') {
    return JSON.parse(value) as T
  }
  return value as T
}

// GET / — 列出所有场景
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scenes = await sceneService.listScenes()
    res.json({ scenes })
  } catch (err) {
    next(err)
  }
})

// GET /:id — 获取单个场景
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scene = await sceneService.getScene(req.params.id)
    if (!scene) {
      res.status(404).json({ error: 'Scene not found' })
      return
    }
    res.json({ scene })
  } catch (err) {
    next(err)
  }
})

// GET /:id/thumbnail — 返回缩略图 png
router.get('/:id/thumbnail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buf = await sceneService.getThumbnail(req.params.id)
    if (!buf) {
      res.status(404).json({ error: 'Thumbnail not found' })
      return
    }
    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'public, max-age=3600')
    res.send(buf)
  } catch (err) {
    next(err)
  }
})

// POST / — 上传新场景
// multipart/form-data:
//   - thumbnail: image/png (file)
//   - name: string (field)
//   - state: SceneState JSON string (field)
//   - cameraPose: OrbitCameraPose JSON string (field)
//   或者用 json 字段一次性传 { state, cameraPose }
router.post(
  '/',
  sceneUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as { thumbnail?: Express.Multer.File[] } | undefined
      const thumbFile = files?.thumbnail?.[0]
      if (!thumbFile) {
        res.status(400).json({ error: 'Missing thumbnail file' })
        return
      }
      const name = req.body.name
      if (!name) {
        res.status(400).json({ error: 'Missing name' })
        return
      }

      let state: SceneState
      let cameraPose: OrbitCameraPose
      if (req.body.json) {
        const parsed = parseMaybeJSON<{ state: SceneState; cameraPose: OrbitCameraPose }>(
          req.body.json,
        )
        state = parsed.state
        cameraPose = parsed.cameraPose
      } else {
        state = parseMaybeJSON<SceneState>(req.body.state)
        cameraPose = parseMaybeJSON<OrbitCameraPose>(req.body.cameraPose)
      }

      const meta = await sceneService.createScene({
        name,
        state,
        cameraPose,
        thumbnail: thumbFile.buffer,
      })
      res.status(201).json({ scene: meta })
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /:id — 删除场景
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await sceneService.getScene(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'Scene not found' })
      return
    }
    await sceneService.deleteScene(req.params.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
