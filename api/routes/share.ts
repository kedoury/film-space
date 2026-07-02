// 分享路由：通过 share token 公开访问场景或视频

import { Router, type Request, type Response, type NextFunction } from 'express'
import sceneService from '../services/SceneService.js'
import videoService from '../services/VideoService.js'

const router = Router()

// GET /scene/:token — 按 token 查询场景
router.get('/scene/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scene = await sceneService.getShareByToken(req.params.token)
    if (!scene) {
      res.status(404).json({ error: 'Shared scene not found' })
      return
    }
    res.json({ scene })
  } catch (err) {
    next(err)
  }
})

// GET /video/:token — 按 token 查询视频
router.get('/video/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const video = await videoService.getShareByToken(req.params.token)
    if (!video) {
      res.status(404).json({ error: 'Shared video not found' })
      return
    }
    res.json({ video })
  } catch (err) {
    next(err)
  }
})

export default router
