// Multer 上传中间件配置
// 使用 memoryStorage：文件直接保存在内存 Buffer 中，避免临时文件清理问题

import multer from 'multer'

// 单文件大小上限（MB），通过 MAX_UPLOAD_MB 环境变量可调
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 50)
const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

const storage = multer.memoryStorage()

const upload = multer({
  storage,
  limits: {
    fileSize: MAX_UPLOAD_BYTES,
  },
})

// 场景上传字段：缩略图 + （可选 json 文本字段）
export const sceneUpload = upload.fields([
  { name: 'thumbnail', maxCount: 1 },
  { name: 'json', maxCount: 1 },
])

// 视频上传字段：webm 视频 + png 缩略图
export const videoUpload = upload.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
])

export default upload
