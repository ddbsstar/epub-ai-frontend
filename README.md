# EPUB AI 前端

Vue 3 + TypeScript + Vite。产品目标是使用 AI，让 EPUB 排版更漂亮、更统一，并保留原文内容。

目前包含中文项目启动页和真实的后端健康检查。页面中的书页是原创静态样章；上传、AI 处理、预览和导出功能尚未实现。MySQL 和千问尚待配置，API 在线不代表数据库或模型服务已经可用。

## 本地开发

前后端统一使用 Node.js 24 LTS（`>=24.15.0`），项目提供 `.nvmrc`。当前系统 Node 20.15.1 需要切换到较新版本。

```sh
npm install
npm run dev
```

打开 <http://127.0.0.1:5173>。开发端口固定为 `5173`，端口被占用时会报错，不会自动切换。

请同时启动独立的 `epub-ai-backend` 项目（默认 `http://127.0.0.1:3000`）。Vite 将 `/api` 请求代理给它；前端调用 `GET /api/health`，要求响应中的 `status` 为 `ok`，`service` 为 `epub-ai-backend`。后端还可返回数据库和模型配置状态，健康检查不会实际调用这些外部服务。

页面加载时会检查连接，也可以点击“刷新状态”重新检查。连接失败或响应不符合约定时会显示“后端暂未连接”。请求超时为 5 秒。

Windows PowerShell 如拦截 `npm.ps1`，可使用 `npm.cmd` 执行上述命令。

## 构建

```sh
npm run build
npm run preview
```

`build` 会先检查 Vue / TypeScript 类型，再生成 `dist/`。`preview` 仅供本地查看产物，默认端口为 `4173`，会沿用本项目的 `/api` 代理。生产环境需由 Nginx 等静态服务器托管 `dist/`，并将 `/api` 转发到后端。

当前前端不需要环境变量。模型 API Key、数据库密码等服务端凭据不得放入前端。

参考：[Vite 官方入门](https://vite.dev/guide/)、[部署静态站点](https://vite.dev/guide/static-deploy.html)。
