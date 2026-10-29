# EPUB AI 前端

Vue 3 + TypeScript + Vite。目标是使用 AI，让 EPUB 排版更漂亮、更统一，并保留原文内容。

目前已将 MagicPath「暖纸书房」设计迁移为 Vue 介绍页：暖纸配色、本地宋体与黑体字体子集、CSS 3D Kindle、原创样章和产品亮点，支持桌面及手机布局。首页「开始美化」进入 `/upload` 上传页，品牌和上传页面包屑可返回首页；其余介绍页入口和排版切换仍是静态外观。上传页保留大加号上传区、纸书封面、深绿下载区和底部进度条，已接入真实 EPUB 上传、拖放、后台任务、状态轮询、停止请求、原书封面和下载。仅完成状态开放下载；进度来自服务器当前步骤的已完成/总单位，不显示估算时间或模拟百分比。首页和未选择文件的空白上传页不请求 API。

当前 `/upload` 主流程为规则排版：选择文件仅上传，用户明确点击「开始排版」后提交 `reader-editorial`，依次整理、校验和发布，不调用模型、不生成插画。完成后显示实际应用排版及保留原样的正文文档、段落、标题与角色数量；零覆盖会明确提示没有应用新样式，不把导出成功当作美观保证。原有插画页面与任务恢复逻辑保留在 `/illustrate` 实验路由，主页面不加载旧插画任务。

历史千问结构识别接口与 `ai` 响应协议保持兼容，旧 `reader-first` API 调用默认不变。新主流程使用独立的 `epub-typography-processing-v1` 会话存储，不读取或删除旧排版、插画任务引用。密钥、模型选择和预算只在后端配置，前端不保存或提交这些参数。

真实健康查询、状态组件、404 和开发基建仍保留。`BackendHealthStatus` 未挂载到介绍页；单独使用时，健康检查只确认基础 API 存活，数据库、千问与任务队列分别展示，不能据此认定业务功能已经可用。

## 本地启动

使用 Node.js 24 LTS（`>=24.15.0`，见 `.nvmrc`）。安装依赖后，复制 `.env.example` 为 `.env.local` 按需修改；默认同源 `/api` 无需额外配置。

项目级 `.npmrc` 使用官方 npm 注册源，锁文件保留依赖完整性校验，可在本机和 CI 使用相同下载地址复现安装。

```sh
npm ci
npm run dev
```

打开 <http://127.0.0.1:5173>。端口被占用时会报错，不会自动切换。当前首页和上传页样式可独立预览；开发接口功能时，独立后端默认运行在 `http://127.0.0.1:3000`，开发服务器会代理 `/api`。Windows PowerShell 如拦截 `npm.ps1`，可使用 `npm.cmd`。

## 目录与职责

```text
src/
  assets/       本地字体子集及开源授权
  styles/       字体声明；页面与组件样式就近维护
  api/          Axios 实例、统一 ApiError、接口函数与响应 Zod schema
  components/   可复用界面组件，例如 KindlePreview、UploadBookCover、BackendHealthStatus
  composables/  Vue Query 等远端状态与组件组合逻辑
  config/       公开配置校验；开发和构建时均校验
  plugins/      QueryClient 工厂及默认策略
  router/       懒加载首页、排版上传页、插画实验页与 404 路由
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

统一请求实例默认超时 10 秒，文件上传单独使用 120 秒，支持 `AbortSignal` 取消，发送 `X-Request-Id` 并保留服务端关联编号。书籍接口使用凭据，由后端 HttpOnly 匿名 Cookie 校验归属；首版使用同源 `/api`。浏览器不保存 API Key、访问 Token、原书内容或数据库密码；`sessionStorage` 只保存上传回执、幂等编号和任务引用，刷新后恢复查询。若未来加入正式账号，应扩展认证、CSRF 与匿名书籍归属迁移。

HTTP、超时、取消、网络及响应格式错误统一为 `ApiError`。界面只显示本地维护的错误文案和请求编号，不显示上游原始 `message`、`details` 或堆栈。`apiRequest` 验证 envelope 和 payload；HTTP 200 但响应格式错误也会报告失败。

`GET /api/health` 的依赖状态为 `disabled`、`not_configured`、`configured_not_checked`、`connected` 或 `unavailable`；`queue` 可省略。即使基础 API 存活，依赖仍可能不可用。页面不会把“已配置但未检测”显示为“已连接”。

## EPUB 业务流程

当前首版仅用于本机开发联调。后端需显式启用处理功能；访问保护拒绝公开远程连接与 production。这里的联调能力不代表已经部署或开放服务。

- `POST /api/v1/uploads`：multipart `file`，客户端限制 100 MiB，服务端仍是权威校验。
- `POST /api/v1/books/:bookId/exports`：主流程发送 `{ theme: "reader-editorial" }` 与 UUID `Idempotency-Key`，提交规则排版任务；API 函数未传主题时仍默认 `reader-first`，保持旧调用兼容。
- `GET /api/v1/runs/:id`：活动任务每 1.5 秒查询一次，终态停止轮询；查询失败立即暂停，用户可手动恢复。
- `POST /api/v1/runs/:id/cancel`：请求停止，服务器确认终态后才展示已停止。
- 仅消费服务端返回的 `/api/v1/artifacts/:id/download` 同源受控路径；下载书籍、处理报告和原书封面不使用外部地址。

上传与创建操作不会自动重试。选择文件只提交上传，不自动创建排版任务。任务创建响应超时后，「确认上次提交结果」复用已上传书籍和同一幂等编号；不会自动重新上传或更换编号。上传响应未知时明确提示重新选择。刷新恢复已知任务编号只 GET 查询，不重新创建任务；创建响应未知且尚未取得任务编号时，回执与原编号仍保留，等待用户明确确认，不自动 POST。

展示服务端的整理/保留正文文档数量与检查计数；`summary.typography` 可选字段补充段落与标题覆盖，按严格计数约束验证，旧响应缺省兼容。有原书封面时展示原封面，无封面或加载失败使用明确标注的书名占位。排版主流程不提供样式编辑、AI 分析、新字体、在线正文预览、AZW3 下载或 Kindle 实机一致性承诺。前端不会渲染 EPUB 内部 HTML，也不会把原书发送到外部图床。

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

`lint:fix` 自动修复可修复的规则，`format` 格式化，`test:watch` 用于开发。测试使用 Vitest、Vue Test Utils、jsdom 与 Axios Mock Adapter，覆盖协议异常、错误脱敏、取消、健康状态/刷新、上传协议/文件约束、任务恢复与真实阶段、创建超时幂等重试、首页与上传页往返和 404 恢复，不依赖真实后端或模型调用。

依赖审计可运行 `npm audit --registry=https://registry.npmjs.org`（部分镜像没有审计端点）。先判断漏洞影响与可用修复，避免直接强制跨大版本升级。

## 构建与部署

`npm run build` 先检查 Vue / TypeScript 类型，再生成 `dist/`。`npm run preview` 仅用于本地检查产物，默认端口 `4173`，沿用 `/api` 代理。生产环境由静态服务器托管 `dist/`，为 Vue Router 提供页面路由回退，同时将 `/api` 单独反代到后端，不能让 API 失败落入 SPA HTML。

参考：[Vue Router](https://router.vuejs.org/)、[Pinia](https://pinia.vuejs.org/)、[TanStack Vue Query](https://tanstack.com/query/latest/docs/framework/vue/overview)、[Axios](https://axios-http.com/docs/intro)、[Vite](https://vite.dev/guide/)。
