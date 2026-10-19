# EPUB AI 前端

Vue 3 + TypeScript + Vite。目标是使用 AI，让 EPUB 排版更漂亮、更统一，并保留原文内容。

目前有中文启动页、真实健康检查、404 页面和开发基建。书页为原创静态样章，上传、AI 处理、排版预览与导出尚未实现。健康检查只确认基础 API 存活；数据库、千问与任务队列的状态分别展示，不能据此认定业务功能已经可用。

## 本地启动

使用 Node.js 24 LTS（`>=24.15.0`，见 `.nvmrc`）。安装依赖后，复制 `.env.example` 为 `.env.local` 按需修改；默认同源 `/api` 无需额外配置。

项目级 `.npmrc` 使用官方 npm 注册源，锁文件保留依赖完整性校验，可在本机和 CI 使用相同下载地址复现安装。

```sh
npm ci
npm run dev
```

打开 <http://127.0.0.1:5173>。端口被占用时会报错，不会自动切换。独立后端默认运行在 `http://127.0.0.1:3000`，开发服务器会代理 `/api`。Windows PowerShell 如拦截 `npm.ps1`，可使用 `npm.cmd`。

## 目录与职责

```text
src/
  api/          Axios 实例、统一 ApiError、接口函数与响应 Zod schema
  components/   可复用界面组件，例如 BackendHealthStatus
  composables/  Vue Query 等远端状态与组件组合逻辑
  config/       公开配置校验；开发和构建时均校验
  plugins/      QueryClient 工厂及默认策略
  router/       懒加载首页与 404 路由
  stores/       Pinia 初始化，后续只放客户端状态
  views/        路由页面
```

`@/` 指向 `src/`。新增页面放 `views/` 并注册路由；页面可复用部分放 `components/`；新增接口放 `api/`，在边界使用 Zod 验证响应，再由 `composables/` 中的查询组合函数消费。组件不直接创建 Axios 实例。

远端数据、加载/错误状态、缓存与刷新由 TanStack Vue Query 管理，不再复制到 Pinia。Pinia 已初始化，未来可用于客户端编辑选项等跨组件状态；当前没有虚构登录状态或无用的占位 store。全局 Query 对网络和超时故障最多重试一次，业务错误不重试；健康查询立即报告失败，不自动重试。Mutation 默认不自动重试，避免重复创建任务或计费。

## API 协议

成功响应：

```json
{
  "data": {
    "status": "ok",
    "service": "epub-ai-backend",
    "dependencies": {
      "database": "disabled",
      "qwen": "configured_not_checked",
      "queue": "disabled"
    }
  },
  "meta": { "requestId": "request-123" }
}
```

错误响应：

```json
{
  "error": { "code": "INTERNAL_ERROR", "message": "服务暂时异常" },
  "meta": { "requestId": "request-123" }
}
```

统一请求实例默认超时 10 秒，支持 `AbortSignal` 取消，发送 `X-Request-Id` 并保留服务端关联编号。未设置跨源凭据，不在浏览器保存 API Key、Token 或数据库密码。若未来加入登录，应单独设计认证与 CSRF 防护。

HTTP、超时、取消、网络及响应格式错误统一为 `ApiError`。界面只显示本地维护的错误文案和请求编号，不显示上游原始 `message`、`details` 或堆栈。`apiRequest` 验证 envelope 和 payload；HTTP 200 但响应格式错误也会报告失败。

`GET /api/health` 的依赖状态为 `disabled`、`not_configured`、`configured_not_checked`、`connected` 或 `unavailable`；`queue` 可省略。即使基础 API 存活，依赖仍可能不可用。页面不会把“已配置但未检测”显示为“已连接”。

## 环境变量

| 变量                   | 默认值                  | 用途                                                                           |
| ---------------------- | ----------------------- | ------------------------------------------------------------------------------ |
| `VITE_API_BASE_URL`    | `/api`                  | 公开的构建时 API 地址；允许同源绝对路径、无凭据的 HTTPS URL，或仅本机 HTTP URL |
| `DEV_API_PROXY_TARGET` | `http://127.0.0.1:3000` | 仅 Vite Node 进程读取的开发代理目标，不会注入浏览器                            |

所有 `VITE_` 变量都会对浏览器用户公开，禁止放任何密钥。`.env.example` 只含公开配置示例；实际 `.env*` 文件已忽略。生产默认使用同源 `/api`，跨域部署时还需要后端明确允许对应前端 Origin。修改构建变量需要重新构建。

## 日常检查

```sh
npm run typecheck
npm run lint
npm run format:check
npm run test
npm run build
# 一次完成全部检查
npm run check
```

`lint:fix` 自动修复可修复的规则，`format` 格式化，`test:watch` 用于开发。测试使用 Vitest、Vue Test Utils、jsdom 与 Axios Mock Adapter，覆盖协议异常、错误脱敏、取消、健康状态/刷新和 404 恢复，不依赖真实后端或模型调用。

依赖审计可运行 `npm audit --registry=https://registry.npmjs.org`（部分镜像没有审计端点）。先判断漏洞影响与可用修复，避免直接强制跨大版本升级。

## 构建与部署

`npm run build` 先检查 Vue / TypeScript 类型，再生成 `dist/`。`npm run preview` 仅用于本地检查产物，默认端口 `4173`，沿用 `/api` 代理。生产环境由静态服务器托管 `dist/`，为 Vue Router 提供页面路由回退，同时将 `/api` 单独反代到后端，不能让 API 失败落入 SPA HTML。

参考：[Vue Router](https://router.vuejs.org/)、[Pinia](https://pinia.vuejs.org/)、[TanStack Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview)、[Axios](https://axios-http.com/docs/intro)、[Vite](https://vite.dev/guide/)。
