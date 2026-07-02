// 后端入口文件
// 加载环境变量、启动服务器、处理未捕获异常

import dotenv from 'dotenv'
import { startServer } from './server.js'

// 加载 .env 配置（Railway/Vercel 注入的环境变量优先级更高）
dotenv.config()

// 全局未捕获异常处理：避免进程静默崩溃
process.on('uncaughtException', (err) => {
  console.error('[fatal] uncaughtException:', err)
  process.exit(1)
})

process.on('unhandledRejection', (reason) => {
  console.error('[fatal] unhandledRejection:', reason)
  process.exit(1)
})

// 启动 HTTP 服务器
startServer().catch((err) => {
  console.error('[fatal] failed to start server:', err)
  process.exit(1)
})
