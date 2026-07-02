# Dockerfile（可选，Railway 默认用 Nixpacks，此文件供其他平台或本地构建用）
FROM node:22-slim

WORKDIR /app

# 复制 package 文件并安装依赖
COPY package*.json ./
RUN npm ci

# 复制源码并构建前端
COPY . .
RUN npm run build

# 创建数据目录
RUN mkdir -p /data/scenes /data/videos

# 环境变量
ENV NODE_ENV=production
ENV VOLUME_PATH=/data
ENV MAX_UPLOAD_MB=50
ENV PORT=3001

EXPOSE 3001

# 启动 Express 服务（同时提供 API + 前端静态文件）
CMD ["npm", "run", "start:prod"]
