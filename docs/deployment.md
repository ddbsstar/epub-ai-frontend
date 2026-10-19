# 开发与容器运行

本仓库是独立的 Vue 前端。以下文件提供可复用的构建、检查与容器运行方式；不表示已经部署到任何服务器。

## 本地开发

使用 `.nvmrc` 指定的 Node.js 24，安装锁文件中的依赖：

```sh
npm ci
npm run dev
```

默认访问 `http://127.0.0.1:5173`。开发服务器把 `/api` 转发到本机后端 `http://127.0.0.1:3000`；后端需另行启动。使用 `DEV_API_PROXY_TARGET` 可以改变开发代理目标，它不是浏览器公开环境变量。

浏览器默认请求同源 `/api`。如需要独立的公开 API 地址，可配置 `VITE_API_BASE_URL`；所有 `VITE_*` 变量都会成为浏览器配置，不能包含 API Key、数据库密码或其他秘密。

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

`.dockerignore` 使用允许清单，排除工作记录、凭据、`.git`、本机依赖及环境文件。不要把父工作区作为 Docker 上下文。

## 同源 API 与路由

`nginx.conf` 的默认后端是同一 Docker 网络中的 `backend:3000`。容器通过 Docker 内置 DNS 按请求解析该名称，因此后端重启或尚未启动时，静态页面仍可打开。

- `/api` 和 `/api/` 下的请求完整转发给后端，保留路径与查询参数；不会回退到 `index.html`。
- 普通前端路由使用 SPA fallback。
- HTML 使用 `no-store`；Vite 生成的 `/assets/` 内容哈希文件可长缓存，不存在的资源返回 `404`。
- Nginx 的 PID 和临时目录位于 `/tmp`，支持非 root 与只读根文件系统。

如果修改构建工具或让 `/assets/` 存放不带内容哈希的文件，需要同时调整缓存规则。

## 与后端仓库组合运行

后端仓库提供 `compose.production.yml`。它假设两个仓库分别检出到相邻的 `backend/`、`frontend/` 目录：

```text
deployment/
  backend/   # ddbsstar/epub-ai-backend 的独立 checkout
  frontend/  # ddbsstar/epub-ai-frontend 的独立 checkout
```

若实际目录名不同，修改后端 Compose 的前端 `build.context`，不把两个 Git 仓库合并。后端密钥只放在后端未跟踪的 `.env` 或运行环境的秘密管理系统中。

在后端目录准备好 `.env` 后，先检查配置，再按需启动：

```sh
docker compose --env-file .env -f compose.production.yml config --quiet
docker compose --env-file .env -f compose.production.yml up --detach --build
```

默认只把前端映射到宿主机 `127.0.0.1:8080`，后端仅在容器网络开放。正式域名与 HTTPS 由入口代理配置。若上层有 TLS 代理，应在受信代理边界配置转发协议与客户端地址，不直接信任任意客户端传入的转发头。

前端已具备路由、请求封装、配置校验、统一错误处理与基础 API 联通；EPUB 上传、AI 排版及导出功能另行开发。

## CI 与依赖更新

GitHub Actions 使用 Node.js 24 和 `npm ci`，按锁文件缓存 npm 下载内容，依次执行格式、lint、类型、测试和构建检查。独立的容器任务构建镜像并实际启动非 root 容器，验证首页、SPA 路由、HTML 缓存与 API 不回退到前端页面；不推送镜像。

工作流仅有 `contents: read` 权限，不保存 checkout 凭据，不使用生产秘密，也不部署。同一分支的新运行会取消旧运行。

Dependabot 每周检查 npm、Actions 与 Docker 基础镜像；次版本和修订版本分组，主要版本单独评审。它不会自动合并。基础镜像使用已核实存在的明确版本标签；如需要不可变发布，可进一步使用对应平台或镜像索引的 digest，并通过依赖更新 PR 维护。

本机没有 Docker 时只能完成静态核验；真实镜像构建和运行结果以 GitHub Actions 的容器任务为准。

参考：[Node 官方镜像](https://hub.docker.com/_/node)、[Nginx 官方镜像](https://hub.docker.com/_/nginx)、[Docker 构建上下文](https://docs.docker.com/build/concepts/context/)。
