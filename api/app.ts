// Express 应用配置
// 注意：本文件只负责应用配置，listen 在 server.ts 中

import express, {
  type Request,
  type Response,
  type NextFunction,
} from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import scenesRoutes from './routes/scenes.js'
import videosRoutes from './routes/videos.js'
import shareRoutes from './routes/share.js'
import healthRoutes from './routes/health.js'

// for esm mode
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app: express.Application = express()

// === 基础中间件 ===
app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

// === API 路由 ===
app.use('/api/scenes', scenesRoutes)
app.use('/api/videos', videosRoutes)
app.use('/api/share', shareRoutes)
app.use('/api/health', healthRoutes)

// === 静态文件服务（仅生产环境，提供前端构建产物） ===
if (process.env.NODE_ENV === 'production') {
  const distDir = path.resolve(__dirname, '../dist')
  app.use(express.static(distDir))
  // SPA 兜底：非 /api 路由回退到 index.html
  app.get(/^\/(?!api).*/, (_req: Request, res: Response) => {
    res.sendFile(path.join(distDir, 'index.html'))
  })
}

// === 错误处理中间件 ===
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[app] error:', err)
  // multer 文件超限错误
  const anyErr = err as Error & { code?: string; status?: number }
  if (anyErr.code === 'LIMIT_FILE_SIZE') {
    res.status(413).json({ error: 'File too large', code: 'LIMIT_FILE_SIZE' })
    return
  }
  res.status(anyErr.status ?? 500).json({
    error: anyErr.message || 'Server internal error',
    code: anyErr.code ?? 'INTERNAL_ERROR',
  })
})

// === 404 兜底 ===
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'API not found', code: 'NOT_FOUND' })
})

export default app
