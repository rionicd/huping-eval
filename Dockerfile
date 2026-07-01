# 阶段一：构建 React 前端
FROM node:20-alpine AS builder

WORKDIR /app

# 复制依赖定义并安装全部依赖（包括开发依赖以支持 Vite 构建）
COPY package*.json ./
RUN npm install

# 复制全部源代码并执行打包
COPY . .
RUN npm run build

# 阶段二：配置生产运行环境
FROM node:20-alpine

WORKDIR /app

# 仅安装生产环境依赖
COPY package*.json ./
RUN npm install --omit=dev

# 从第一阶段拷贝打包好的前端静态文件，并拷贝后端服务代码
COPY --from=builder /app/dist ./dist
COPY server.js ./
COPY db.json ./

# 微信云托管容器默认监听 80 端口
ENV PORT=80
EXPOSE 80

# 启动 Express 服务
CMD ["node", "server.js"]
