# 开发与容器运行

本仓库是独立的 Vue 前端。以下文件提供可复用的构建、检查与容器运行方式；不表示已经部署到任何服务器。

## 本地开发

使用 `.nvmrc` 指定的 Node.js 24，安装锁文件中的依赖：

```sh
npm ci
npm run dev
```

默认访问 `http://127.0.0.1:5173`。首页与空白 `/upload` 可独立启动预览；上传页选择 EPUB 后上传，由用户明确点击开始后提交 `reader-editorial` 纯排版任务。开发服务器把 `/api` 转发到本机后端 `http://127.0.0.1:3000`，后端需另行启动。使用 `DEV_API_PROXY_TARGET` 可以改变开发代理目标，它不是浏览器公开环境变量。

API 客户端的默认地址为同源 `/api`；上传页的书籍业务通过该客户端调用版本化 `/api/v1` 接口。如需要独立的公开 API 地址，可配置 `VITE_API_BASE_URL`；所有 `VITE_*` 变量都会成为浏览器配置，不能包含 API Key、数据库密码或其他秘密。

## 生产镜像

在本仓库根目录执行构建，以本仓库作为上下文：

```sh
docker build --pull --target runtime --tag epub-ai-frontend:local .
```

镜像先在 Node.js 24.19.0 中安装锁定依赖并生成 `dist/`，再把静态文件复制到 Nginx 1.30.6 Alpine。最终容器以 `nginx` 用户监听 `8080`，不包含 Node、源码、开发依赖或 `.env`。

可选的公开构建参数：

```sh
docker build --target runtime --tag epub-ai-frontend:local --build-arg VITE_API_BASE_URL=/api .
```

这类变量在构建时写入静态文件。启动容器时设置 `VITE_API_BASE_URL` 不会改变已构建的页面。

公开排版试用构建使用 `VITE_PUBLIC_BETA=true`，让页面显示试用标识、20 MiB 客户端限制及上传24小时后的文件自动删除说明；必须同时启用后端对应的公开试用策略。此参数只控制前端披露和预检查，不是访问保护，实际大小、归属、配额、到期清理与禁用模型都由后端执行。普通本地开发默认仍为100 MiB，不宣称自动清理。生产构建完全不注册 `/illustrate`，Vite 会排除该实验页的懒加载入口；开发环境仍保留插画实验。

可以由 Caddy 直接提供构建后的 `dist/`，与同域 `/api` 反向代理到仅绑定 loopback 的后端配合运行，不要求 Nginx 或 Docker。该方式必须在 Caddy 分开处理 `/api`，API 错误不得回退为 SPA HTML，并由入口代理设置经过信任校验的 Host / HTTPS 协议头。后端公网试用仅信任明确配置的公开 origin，不信任任意传入头。入口代理需覆盖响应头：`X-Content-Type-Options: nosniff`、`Referrer-Policy: same-origin`、禁止iframe嵌入，并给 HTML 设置 `Cache-Control: no-store`，哈希资源可长缓存。书籍下载及API响应不得缓存。

`.dockerignore` 使用允许清单，排除工作记录、凭据、`.git`、本机依赖及环境文件。不要把父工作区作为 Docker 上下文。

## 同源 API 与路由

`nginx.conf` 的默认后端是同一 Docker 网络中的 `backend:3000`。容器通过 Docker 内置 DNS 按请求解析该名称，因此后端重启或尚未启动时，静态页面仍可打开。

- `/api` 和 `/api/` 下的请求完整转发给后端，保留路径与查询参数；不会回退到 `index.html`。
- 普通前端路由使用 SPA fallback。
- HTML 使用 `no-store`；Vite 生成的 `/assets/` 内容哈希文件可长缓存，不存在的资源返回 `404`。
- Nginx 的 PID 和临时目录位于 `/tmp`，支持非 root 与只读根文件系统。

如果修改构建工具或让 `/assets/` 存放不带内容哈希的文件，需要同时调整缓存规则。

## 与后端仓库组合运行

后端仓库提供 `compose.production.yml`。它假设两个仓库分别检出到相邻的 `epub-ai-backend/`、`epub-ai-frontend/` 目录：

```text
deployment/
  epub-ai-backend/   # ddbsstar/epub-ai-backend 的独立 checkout
  epub-ai-frontend/  # ddbsstar/epub-ai-frontend 的独立 checkout
```

若实际目录名不同，修改后端 Compose 的前端 `build.context`，不把两个 Git 仓库合并。后端密钥只放在后端未跟踪的 `.env` 或运行环境的秘密管理系统中。

在后端目录准备好 `.env` 后，先检查配置，再按需启动：

```sh
docker compose --env-file .env -f compose.production.yml config --quiet
docker compose --env-file .env -f compose.production.yml up --detach --build
```

默认只把前端映射到宿主机 `127.0.0.1:8080`，后端仅在容器网络开放。正式域名与 HTTPS 由入口代理配置。若上层有 TLS 代理，应在受信代理边界配置转发协议与客户端地址，不直接信任任意客户端传入的转发头。

前端已具备路由、请求封装、配置校验、统一错误处理与 EPUB 上传、规则排版任务、进度查询和导出联调。公开运行需后端显式开启生产排版试用与对应的同源 HTTPS 访问保护；不能直接代理本地开发模式。书籍归属使用后端 HttpOnly 匿名 Cookie，保持前后端同源。Nginx 的通用容器配置为精确 `/api/v1/uploads` 路由配置101 MiB（兼容本地100 MiB及 multipart 余量）、120/125 秒超时与请求流式转发，不把完整书籍缓存在前端容器的小 `/tmp`；公开试用后端仍强制20 MiB文件本体上限。入口代理需使用匹配的公开试用大小与超时限制。默认 Nginx 仅将自身观测到的 `$scheme` 转发，不信任公网客户端伪造的 `X-Forwarded-Proto`；多层 TLS 代理场景需按明确的受信代理网段单独配置，不能直接照抄任意传入协议头。

## CI 与依赖更新

GitHub Actions 使用 Node.js 24 和 `npm ci`，按锁文件缓存 npm 下载内容，依次执行格式、lint、类型、测试和构建检查。独立的容器任务构建镜像并实际启动非 root 容器，验证首页、SPA 路由、HTML 缓存与 API 不回退到前端页面；不推送镜像。

工作流仅有 `contents: read` 权限，不保存 checkout 凭据，不使用生产秘密，也不部署。同一分支的新运行会取消旧运行。

Dependabot 每周检查 npm、Actions 与 Docker 基础镜像；次版本和修订版本分组，主要版本单独评审。它不会自动合并。基础镜像使用已核实存在的明确版本标签；如需要不可变发布，可进一步使用对应平台或镜像索引的 digest，并通过依赖更新 PR 维护。

本机没有 Docker 时只能完成静态核验；真实镜像构建和运行结果以 GitHub Actions 的容器任务为准。

参考：[Node 官方镜像](https://hub.docker.com/_/node)、[Nginx 官方镜像](https://hub.docker.com/_/nginx)、[Docker 构建上下文](https://docs.docker.com/build/concepts/context/)。
