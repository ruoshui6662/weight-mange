<!--
文档版本：v1.0
日期：2026-09-08
项目定位：个人自用、自托管 Docker 饮食/体重/运动/减脂管理应用
设计原则：Local-first / Single-user-first / Modular Monolith / Data Traceability / AI as Assistant
-->

# DOCKER_DEPLOYMENT.md

## 1. 部署目标

本项目的 Docker 目标不是“容器化一下就算完成”，而是：

- 一条命令启动；
- 一个数据目录即可备份；
- 升级前自动备份；
- 失败可回滚；
- x86_64 / arm64 NAS 都能运行；
- 不依赖 Redis/PostgreSQL；
- 外部 AI/食物 API 全部可选；
- 核心功能断网可用。

---

## 2. 推荐生产形态

首版只需要一个业务容器：

```text
nutrition-tracker
  ├─ Fastify API
  ├─ React PWA static files
  ├─ SQLite
  ├─ uploads
  └─ backup scheduler
```

持久化全部放在：

```text
/data
```

目录：

```text
/data/
├─ db/
│  └─ app.sqlite
├─ uploads/
│  ├─ food/
│  ├─ meals/
│  └─ ai/
├─ backups/
├─ imports/
├─ cache/
└─ logs/          # 可选，默认 stdout
```

---

# 3. Docker Compose

推荐：

```yaml
services:
  nutrition-tracker:
    image: ghcr.io/yourname/nutrition-tracker:0.1.0
    container_name: nutrition-tracker
    restart: unless-stopped

    ports:
      - "3000:3000"

    volumes:
      - ./data:/data

    environment:
      APP_PORT: "3000"
      DATA_DIR: "/data"
      DB_PATH: "/data/db/app.sqlite"
      UPLOAD_DIR: "/data/uploads"
      BACKUP_DIR: "/data/backups"

      APP_TIMEZONE: "Asia/Shanghai"
      AUTH_MODE: "password"

      APP_SECRET: "${APP_SECRET}"

      AI_PROVIDER: "${AI_PROVIDER:-}"
      AI_BASE_URL: "${AI_BASE_URL:-}"
      AI_API_KEY: "${AI_API_KEY:-}"
      AI_MODEL: "${AI_MODEL:-}"

    healthcheck:
      test: ["CMD", "node", "/app/scripts/healthcheck.mjs"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

本项目自用情况下：
- 不需要数据库 service；
- 不需要 Redis；
- 不需要独立前端容器。

---

# 4. .env

示例：

```env
APP_SECRET=请生成一个足够长的随机字符串

AI_PROVIDER=oai-compatible
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
```

生成 secret：

```bash
openssl rand -base64 48
```

不要把 `.env` commit。

---

# 5. Dockerfile

使用 multi-stage：

```dockerfile
# web build
FROM node:24-bookworm-slim AS web-build
WORKDIR /src
# install + build web

# api build
FROM node:24-bookworm-slim AS api-build
WORKDIR /src
# install + build api

# runtime
FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
# copy compiled api
# copy web dist
# copy migrations
# expose 3000
CMD ["node", "server.js"]
```

### 为什么 bookworm-slim
- glibc 兼容性比 alpine 省心；
- SQLite/图像处理 native 依赖少踩坑；
- 镜像仍可控制大小。

如果完全使用 node:sqlite、纯 JS 图片库，可以进一步减小镜像。

---

# 6. 多架构构建

目标：

```text
linux/amd64
linux/arm64
```

GitHub Actions：

```text
docker buildx build
--platform linux/amd64,linux/arm64
```

标签：

```text
0.1.0
0.1
0
latest
```

稳定自用建议 pin：

```text
0.4.2
```

而不是长期使用 `latest`。

---

# 7. 启动流程

容器 entrypoint：

```text
1. create /data dirs
2. permission check
3. database exists?
4. if not → init
5. database quick_check
6. detect migration
7. if migration needed → pre-migration backup
8. apply migrations
9. validate schema
10. start Fastify
```

如果数据库损坏：

```text
不要自动创建一个新的空 DB 覆盖
```

必须退出并输出：

```text
DATABASE_INTEGRITY_FAILED
```

---

# 8. SQLite Backup

SQLite WAL 模式下不能只在运行时粗暴 `cp app.sqlite`。

推荐：
- SQLite backup API；
- 或 `VACUUM INTO`；
- 或应用内部一致性 snapshot。

备份流程：

```text
checkpoint
 ↓
consistent backup DB
 ↓
calculate sha256
 ↓
manifest
 ↓
zip/tar
```

---

# 9. Backup Manifest

```json
{
  "formatVersion": 1,
  "createdAt": "...",
  "appVersion": "0.4.2",
  "schemaVersion": "20260908_004",
  "foodDataset": {
    "key": "cfcd6-sanotsu",
    "version": "20260825-fixed-en"
  },
  "databaseSha256": "...",
  "uploadsIncluded": true
}
```

---

# 10. 自动备份策略

自用建议：

```text
每日 1 次
保留最近 7 个 daily
每周 1 个，保留 4 个
每月 1 个，保留 6 个
```

如果数据量很小，甚至可保留更多。

每次：
- program upgrade；
- schema migration；
- restore；

都自动额外生成备份。

---

# 11. Restore

恢复前：

```text
validate archive
 ↓
verify checksum
 ↓
check schema compatibility
 ↓
create pre-restore backup
 ↓
maintenance mode
 ↓
restore DB/uploads
 ↓
PRAGMA integrity_check
 ↓
migration if needed
 ↓
reindex FTS
 ↓
start
```

任何一步失败：
- 恢复原 pre-restore backup；
- 不留下半恢复状态。

---

# 12. 数据库升级

Migration 规则：

```text
forward-only migrations
```

不要求 SQL down migration。

原因：
- 真正的回滚是恢复升级前 DB backup；
- SQLite schema rollback 脚本往往比 backup 恢复风险更高。

每个 release：

```text
old image + old DB
new image start
prebackup
migration
verify
```

---

# 13. 应用升级流程

推荐手动升级：

```bash
docker compose pull
docker compose up -d
```

但系统内部要自动：
- pre-migration backup；
- migration；
- health check。

升级后检查：

```bash
docker compose ps
docker compose logs --tail=100 nutrition-tracker
```

---

# 14. 回滚

例如：

```text
0.5.0 → 出问题
```

步骤：

```bash
docker compose down
# compose image 改回 0.4.2
# 从 pre-migration backup 恢复
docker compose up -d
```

不建议“旧镜像直接打开新 schema DB”。

---

# 15. Health Checks

### /api/v1/system/health

只检查：
- HTTP；
- DB SELECT；
- migrations complete。

不要 healthcheck：
- AI API；
- OFF；
- USDA。

否则外网故障会让 Docker 误判整个应用 unhealthy。

### readiness
启动迁移完成前返回 non-ready。

---

# 16. Reverse Proxy

局域网可：

```text
http://nas:3000
```

如果跨设备长期使用，建议 Caddy：

```text
https://food.example.lan
```

Caddy 示例：

```caddyfile
food.example.com {
  reverse_proxy nutrition-tracker:3000
}
```

如果只在 Tailscale 网络中：
- 可直接 Tailscale IP；
- 或 Tailscale Serve；
- 仍建议 HTTPS。

---

# 17. Security

即使自用：

- 设密码；
- 设 APP_SECRET；
- 不把端口直接暴露公网；
- 如果公网访问，必须 HTTPS；
- 最好走 Tailscale/VPN；
- AI API Key 不写日志；
- 限制文件上传；
- 定期备份到另一个磁盘。

---

# 18. NAS 场景

适合：
- 飞牛 NAS；
- Synology；
- Unraid；
- 普通 Debian；
- OpenWrt x86（资源足够时不推荐放路由器）；
- 小型 Linux 主机。

SQLite DB 最好放本地可靠文件系统。

不建议：
- SQLite DB 直接放不稳定 SMB/NFS 网络挂载；
- 云同步工具实时同步正在写入的 sqlite 文件。

如果要同步：
- 同步 backup 文件；
- 不同步 live DB。

---

# 19. Resource Limits

自用建议：

```yaml
deploy:
  resources:
    limits:
      memory: 768M
```

如果 Docker Compose 非 swarm，具体资源写法按 Docker 版本调整。

目标：
- idle 150–300MB；
- AI 图片仅上传到外部模型时，内存峰值可高一些；
- 不在本地运行大模型。

---

# 20. 图片处理

上传：
- 最大原图建议 10MB；
- 解码后限制长边；
- 餐照存 WebP/JPEG；
- thumbnail 320–480px。

文件名：

```text
<uuid>.webp
```

不直接使用用户原文件名做路径。

---

# 21. AI 网络隔离

AI 模块可完全禁用：

```env
AI_ENABLED=false
```

关闭后：
- AI 页面隐藏/显示未配置；
- diary 正常；
- food 正常；
- analytics 正常。

Provider timeout：
```text
30s
```

失败：
- 不触发容器重启；
- 只返回 AI_PROVIDER_ERROR。

---

# 22. Food Import

不建议把第三方书籍截图直接 bake 进公共 Docker image。

自用推荐：

```text
/data/imports/cfcd6/
```

用户手动放入 Sanotsu 导出的 JSON，或者开发阶段脚本拉取。

导入命令示例：

```bash
docker exec nutrition-tracker \
  node cli.js food import /data/imports/cfcd6
```

或者 UI 高级设置中上传。

---

# 23. CLI

建议提供：

```text
node cli.js db check
node cli.js db migrate
node cli.js backup create
node cli.js backup list
node cli.js backup verify <file>
node cli.js food import <path>
node cli.js food validate <dataset-id>
node cli.js food promote <dataset-id>
node cli.js food reindex
node cli.js diagnostics
```

容器出现问题时 CLI 比只能打开 Web UI 更可靠。

---

# 24. 日志

默认 stdout：

```text
docker logs
```

Pino JSON。

生产可配置 pretty=false。

日志轮转由 Docker：

```yaml
logging:
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"
```

---

# 25. Scheduled Jobs

不引入 cron sidecar。

应用内部 scheduler：
- daily backup；
- cleanup temp files；
- cleanup AI cache；
- database optimize；
- optional external cache refresh。

scheduler job 必须：
- 使用 lock；
- 重启后不重复执行同一 daily job；
- 失败不导致进程退出。

---

# 26. Maintenance

每周或每月：
- `PRAGMA optimize`;
- backup verify sample；
- 清理 orphan uploads；
- compact AI cache。

不建议频繁 VACUUM，因为会产生额外 IO。

---

# 27. Disaster Recovery

灾难场景：

### 容器没了
重新拉镜像 + 挂载 `/data`。

### 主机坏了
从 backup archive 恢复。

### DB migration 坏了
恢复 pre-migration backup + pin 旧版本。

### 食物 dataset 导坏了
food dataset promote 是事务；恢复 archived active dataset。

### AI 配置坏了
清除 AI config，不影响 DB 业务数据。

---

# 28. CI/CD

每次 PR：

```text
lint
typecheck
unit tests
integration tests
web build
api build
docker build
```

release：

```text
E2E
migration test fixture
multi-arch image
SBOM
image tag
release notes
```

---

# 29. 测试数据库 Fixtures

维护：

```text
fixtures/db/
  v0.1.sqlite
  v0.2.sqlite
  current-small.sqlite
```

每次 release 测试：
- 从历史 DB 启动；
- 自动迁移；
- golden data 数量不变。

---

# 30. PWA

生产静态资源由 Fastify 提供。

PWA cache：
- app shell；
- icons；
- static CSS/JS。

不要长期缓存 `/api/v1/*` mutation。

读取 API 可以由 TanStack Query 管理，不依赖 Service Worker 做复杂离线数据库同步。

V1 离线目标：
- 已打开 UI 可显示；
- 局域网 server 不可达时提示 offline；
- 不做完全离线写入队列。

如果未来需要手机断开 NAS 也能写，再单独设计 offline sync，不要首版就做。

---

# 31. 推荐 docker-compose 自用最终模板

```yaml
services:
  app:
    image: ghcr.io/yourname/nutrition-tracker:0.1.0
    container_name: nutrition-tracker
    restart: unless-stopped
    ports:
      - "3000:3000"
    volumes:
      - "./data:/data"
    env_file:
      - ".env"
    logging:
      driver: json-file
      options:
        max-size: "10m"
        max-file: "3"
    healthcheck:
      test: ["CMD", "node", "/app/scripts/healthcheck.mjs"]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 30s
```

---

# 32. 上线前 Checklist

- [ ] APP_SECRET 已生成
- [ ] 密码已设置
- [ ] `/data` 权限正确
- [ ] SQLite WAL 正常
- [ ] 中国食物数据已导入并验证
- [ ] Golden foods 搜索正常
- [ ] Diary snapshot 测试通过
- [ ] backup 可创建
- [ ] backup 可在临时目录恢复
- [ ] migration fixture 通过
- [ ] AI disabled 情况主功能正常
- [ ] AI timeout 不影响主系统
- [ ] 390px UI 无溢出
- [ ] 1440px Desktop 无巨大空洞
- [ ] Docker restart 数据不丢
- [ ] NAS 重启后容器自动拉起

---

# 33. 发布原则

稳定自用优先：

> **宁可功能少，也不要升级一次把数据库搞坏。**

所以：
- 数据结构修改必须 migration；
- migration 必须 prebackup；
- 食物数据升级必须 staging；
- AI 永远是 optional；
- live DB 不做云盘实时同步；
- image 版本尽量 pin。
