// 视频路由：视频元数据 CRUD、缩略图、流式播放（支持 Range）

import fs from 'fs'
import { Router, type Request, type Response, type NextFunction } from 'express'
import videoService from '../services/VideoService.js'
import { videoUpload } from '../middleware/upload.js'

const router = Router()

// GET / — 列出所有视频
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const videos = await videoService.listVideos()
    res.json({ videos })
  } catch (err) {
    next(err)
  }
})

// GET /:id — 获取视频元数据
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const video = await videoService.getVideo(req.params.id)
    if (!video) {
      res.status(404).json({ error: 'Video not found' })
      return
    }
    res.json({ video })
  } catch (err) {
    next(err)
  }
})

// GET /:id/thumbnail — 返回缩略图 png
router.get('/:id/thumbnail', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const buf = await videoService.getThumbnail(req.params.id)
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

// GET /:id/file — 流式返回 webm，支持 Range header
router.get('/:id/file', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await videoService.getFileInfo(req.params.id)
    if (!info) {
      res.status(404).json({ error: 'Video file not found' })
      return
    }
    const { path: filePath, size } = info
    const range = req.headers.range

    res.setHeader('Content-Type', 'video/webm')
    res.setHeader('Accept-Ranges', 'bytes')

    if (range) {
      // 解析 "bytes=start-end"
      const match = /bytes=(\d*)-(\d*)/.exec(range)
      if (!match) {
        res.status(416).setHeader('Content-Range', `bytes */${size}`).end()
        return
      }
      const start = match[1] ? parseInt(match[1], 10) : 0
      const end = match[2] ? parseInt(match[2], 10) : size - 1
      if (start >= size || end >= size || start > end) {
        res.status(416).setHeader('Content-Range', `bytes */${size}`).end()
        return
      }
      const chunkSize = end - start + 1
      res.status(206)
      res.setHeader('Content-Range', `bytes ${start}-${end}/${size}`)
      res.setHeader('Content-Length', String(chunkSize))
      fs.createReadStream(filePath, { start, end }).pipe(res)
    } else {
      res.setHeader('Content-Length', String(size))
      fs.createReadStream(filePath).pipe(res)
    }
  } catch (err) {
    next(err)
  }
})

// POST / — 上传新视频
// multipart/form-data:
//   - video: video/webm (file)
//   - thumbnail: image/png (file)
//   - name, durationMs, width, height (form fields)
router.post(
  '/',
  videoUpload,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as
        | { video?: Express.Multer.File[]; thumbnail?: Express.Multer.File[] }
        | undefined
      const videoFile = files?.video?.[0]
      const thumbFile = files?.thumbnail?.[0]
      if (!videoFile) {
        res.status(400).json({ error: 'Missing video file' })
        return
      }
      if (!thumbFile) {
        res.status(400).json({ error: 'Missing thumbnail file' })
        return
      }
      const name = req.body.name
      if (!name) {
        res.status(400).json({ error: 'Missing name' })
        return
      }
      const durationMs = Number(req.body.durationMs)
      const width = Number(req.body.width)
      const height = Number(req.body.height)
      if (!Number.isFinite(durationMs) || !Number.isFinite(width) || !Number.isFinite(height)) {
        res.status(400).json({ error: 'Invalid durationMs/width/height' })
        return
      }
      const meta = await videoService.createVideo({
        name,
        durationMs,
        width,
        height,
        file: videoFile.buffer,
        thumbnail: thumbFile.buffer,
      })
      res.status(201).json({ video: meta })
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /:id — 删除视频
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await videoService.getVideo(req.params.id)
    if (!existing) {
      res.status(404).json({ error: 'Video not found' })
      return
    }
    await videoService.deleteVideo(req.params.id)
    res.status(204).end()
  } catch (err) {
    next(err)
  }
})

export default router
