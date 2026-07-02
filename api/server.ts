// HTTP 服务器入口
// 创建 http.Server 并启动监听，导出 startServer 函数

import http from 'http'
import path from 'path'
import { fileURLToPath } from 'url'
import app from './app.js'
import metadataStore from './services/MetadataStore.js'

const PORT = Number(process.env.PORT ?? 3001)
const __filename = fileURLToPath(import.meta.url)

let server: http.Server | null = null

// 启动 HTTP 服务器
export async function startServer(port: number = PORT): Promise<http.Server> {
  // 启动前预加载元数据索引
  await metadataStore.load()

  server = http.createServer(app)

  server.listen(port, () => {
    console.log(`[server] ready on port ${port}`)
  })

  // 优雅关闭
  const shutdown = (signal: string) => {
    console.log(`[server] ${signal} received, closing...`)
    if (!server) return process.exit(0)
    server.close(() => {
      console.log('[server] closed')
      process.exit(0)
    })
  }
  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))

  return server
}

// 直接运行此文件时（nodemon / tsx api/server.ts）自动启动；
// 被 index.ts 导入时则由 index.ts 显式调用 startServer()
const isDirectRun = !!process.argv[1] && path.resolve(process.argv[1]) === __filename
if (isDirectRun) {
  startServer().catch((err) => {
    console.error('[server] failed to start:', err)
    process.exit(1)
  })
}

export default app
