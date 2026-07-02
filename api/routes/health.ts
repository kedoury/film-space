// 健康检查路由

import { Router, type Request, type Response } from 'express'

const router = Router()

// GET / — 返回服务健康状态
router.get('/', (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  })
})

export default router
