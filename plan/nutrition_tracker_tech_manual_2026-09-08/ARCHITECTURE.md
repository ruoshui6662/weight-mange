<!--
文档版本：v1.0
日期：2026-09-08
项目定位：个人自用、自托管 Docker 饮食/体重/运动/减脂管理应用
设计原则：Local-first / Single-user-first / Modular Monolith / Data Traceability / AI as Assistant
-->

# ARCHITECTURE.md

## 1. 总体架构结论

本项目采用：

> **模块化单体（Modular Monolith） + 单 Docker 容器 + SQLite + React PWA + TypeScript 全栈。**

目标不是追求“架构看起来先进”，而是让一个长期自用项目具备：

- 易安装；
- 易升级；
- 易回滚；
- 易备份；
- 模块边界清晰；
- AI、外部数据源故障不影响主功能；
- 未来需要时可以把单个模块独立拆出。

不采用微服务。个人自用场景下，微服务只会增加网络调用、部署、监控、事务和升级复杂度。

---

## 2. 推荐技术栈

### 2.1 前端

| 层 | 技术 | 说明 |
|---|---|---|
| Framework | React 19 + TypeScript | 生态成熟、组件化适合精细 UI |
| Build | Vite | 开发启动快、PWA 友好 |
| Routing | React Router | 路由简单稳定 |
| Server State | TanStack Query | API 缓存、重试、失效管理 |
| Form | React Hook Form | 复杂表单性能好 |
| Validation | Zod | 与后端 contract 共用 |
| Local UI State | Zustand | 只保存短生命周期 UI 状态 |
| CSS | Tailwind CSS + CSS Variables | token 驱动、方便精确复刻 |
| Headless UI | Radix UI primitives | Dialog/Popover/Sheet 等基础能力 |
| Charts | Apache ECharts（按需 lazy load） | 趋势图、双轴图、响应式能力强 |
| Icons | Lucide React + 少量自绘 SVG | 统一细线风格 |
| PWA | vite-plugin-pwa / Workbox | 添加到桌面、离线 shell |

禁止使用 Ant Design、Material UI 作为主 UI，因为其默认视觉语言会破坏薄荷式轻量设计。

### 2.2 后端

| 层 | 技术 | 说明 |
|---|---|---|
| Runtime | Node.js 24 LTS | 2026 年稳定 LTS 线 |
| HTTP | Fastify 5 | 低开销、schema 清晰 |
| Validation | Zod / JSON Schema bridge | 输入输出均校验 |
| ORM/SQL | Drizzle ORM | schema/migration 明确 |
| DB Driver | node:sqlite | 减少 native addon 依赖 |
| Database | SQLite 3, WAL | 单机最适合 |
| Logging | Pino | Fastify 原生日志生态 |
| File Upload | Fastify multipart | 餐照/备份 |
| Job | 内置轻量 scheduler | 无 Redis 依赖 |

### 2.3 为什么不用 Next.js

本项目并不需要 SEO、SSR、Server Components。

使用：
- React SPA/PWA；
- Fastify API；
- 同容器静态文件服务；

更清晰，升级风险更低，也更适合 NAS/self-host。

---

## 3. 仓库结构

建议 pnpm workspace：

```text
repo/
├─ apps/
│  ├─ web/
│  │  ├─ src/
│  │  │  ├─ app/
│  │  │  ├─ pages/
│  │  │  ├─ features/
│  │  │  ├─ components/
│  │  │  ├─ hooks/
│  │  │  ├─ styles/
│  │  │  └─ assets/
│  │  └─ vite.config.ts
│  │
│  └─ api/
│     ├─ src/
│     │  ├─ core/
│     │  ├─ modules/
│     │  ├─ db/
│     │  ├─ http/
│     │  └─ app.ts
│     └─ drizzle/
│
├─ packages/
│  ├─ contracts/
│  ├─ nutrition-engine/
│  ├─ ui-tokens/
│  ├─ shared/
│  └─ test-fixtures/
│
├─ tools/
│  ├─ food-import/
│  ├─ db-check/
│  └─ backup-inspect/
│
├─ docker/
├─ docs/
├─ tests/
├─ docker-compose.yml
├─ Dockerfile
├─ pnpm-workspace.yaml
└─ package.json
```

---

## 4. 后端模块边界

每个业务模块按四层组织：

```text
modules/food/
├─ domain/
│  ├─ entities/
│  ├─ value-objects/
│  └─ policies/
├─ application/
│  ├─ commands/
│  ├─ queries/
│  └─ services/
├─ infrastructure/
│  ├─ repositories/
│  └─ adapters/
└─ api/
   ├─ routes.ts
   └─ schemas.ts
```

### 4.1 模块职责

#### core
- app config
- logger
- database bootstrap
- migrations
- clock
- ID generator
- encryption
- domain event dispatcher
- error types
- health checks

#### profile
- 用户基础资料
- 能量目标
- 宏量目标
- timezone
- units

#### food
- 食物主表
- 营养成分
- alias
- serving
- density
- source
- quality
- search

#### food-import
- dataset staging
- JSON parser
- normalization
- validation
- diff
- version promote

#### diary
- meal slot
- diary entries
- copy meal/day
- snapshot generation

#### recipe
- recipe
- ingredients
- cooked yield
- servings
- nutrient calculation

#### body
- weight
- waist/other optional measurements
- trend normalization

#### activity
- activity catalog
- manual activity log
- MET calculation

#### analytics
- daily aggregate
- rolling average
- goal comparison
- nutrition coverage

#### adaptive-tdee
- weight trend
- intake trend
- energy balance regression
- confidence

#### ai
- provider config
- prompt templates
- tool schema
- image/text analysis
- conversation
- cached analysis
- proposed changes

#### integrations
- Open Food Facts
- USDA
- future barcode/health APIs

#### backup
- DB snapshot
- export JSON/CSV
- restore validation
- manifest

---

## 5. 模块依赖规则

只允许以下方向：

```text
UI
 ↓
HTTP API
 ↓
Application Services
 ↓
Domain
 ↓
Repository Interfaces
 ↓
Infrastructure
```

跨模块依赖：

```text
Diary → FoodCatalogReader
Diary → NutritionEngine
Recipe → FoodCatalogReader
Analytics → DiaryReadModel
Analytics → BodyReadModel
AI → Read-only Context Facade
AI → Proposal Service
```

不允许：

```text
AI → diary_entries 表直接 INSERT
UI → SQLite
Recipe → FoodRepository concrete class
Analytics → 修改 Diary 数据
```

所有跨模块访问都通过显式 interface。

---

## 6. Domain Event 设计

不引入 Kafka/NATS。使用**进程内 domain event bus**。

示例：

```text
DiaryEntryCreated
DiaryEntryUpdated
DiaryEntryDeleted
WeightRecorded
FoodDatasetPromoted
RecipeUpdated
```

用途：
- 失效统计缓存；
- 标记 AI 分析过期；
- 重建 read model；
- 写审计日志。

原则：
- 核心写入事务不依赖异步事件成功；
- event handler 失败记日志，不回滚用户已完成的日记写入；
- 必须事务一致的操作放在同一个 application service 内，不依赖 event。

---

## 7. 数据流

### 7.1 添加食物记录

```text
Web
  POST /api/v1/diary/entries
        ↓
Diary route schema validation
        ↓
DiaryApplicationService
        ↓
FoodCatalogReader.getFoodBasis()
        ↓
NutritionEngine.scale()
        ↓
生成 nutrient snapshot
        ↓
BEGIN TRANSACTION
  insert diary_entry
  insert diary_entry_nutrients
COMMIT
        ↓
emit DiaryEntryCreated
        ↓
invalidate day summary
        ↓
response
```

### 7.2 食物搜索

```text
query
 ↓
normalize Chinese
 ↓
exact name
 ↓
alias
 ↓
recent/favorite boost
 ↓
FTS/pinyin
 ↓
external source（可选且仅本地无结果时）
```

### 7.3 AI 分析

```text
用户请求分析
 ↓
AIContextBuilder
 ↓
生成最小必要上下文
 ↓
ProviderAdapter
 ↓
LLM JSON/Text
 ↓
Schema validation
 ↓
AIResult
 ↓
仅展示
```

如果是“自然语言录入”：

```text
LLM candidate
 ↓
Food Matching
 ↓
Proposal
 ↓
用户确认
 ↓
Diary Application Service
```

---

## 8. API 边界

统一前缀：

```text
/api/v1
```

路由只负责：

1. auth/session；
2. request validation；
3. application service 调用；
4. error mapping；
5. response serialization。

路由中禁止出现：
- SQL；
- kcal 公式；
- prompt 拼接；
- 复杂业务判断。

---

## 9. 鉴权策略

虽然是自用，也不建议裸奔。

### 默认模式

首次启动：
- 创建一个本地用户；
- 密码 hash；
- session cookie；
- HttpOnly；
- SameSite=Lax；
- Secure 在 HTTPS 下开启。

### 可选 LAN trusted mode

可配置：

```text
AUTH_MODE=password
AUTH_MODE=trusted_lan
```

`trusted_lan` 只建议在已经有反向代理鉴权、Tailscale 或可信家庭 LAN 环境中使用。

### 不做
- OAuth 社交登录；
- 多租户权限系统；
- RBAC。

---

## 10. 配置系统

优先级：

```text
ENV > database settings > defaults
```

示例：

```env
APP_PORT=3000
APP_TIMEZONE=Asia/Shanghai
DATA_DIR=/data
DB_PATH=/data/db/app.sqlite
UPLOAD_DIR=/data/uploads
BACKUP_DIR=/data/backups

AUTH_MODE=password
APP_SECRET=...

AI_PROVIDER=oai-compatible
AI_BASE_URL=
AI_API_KEY=
AI_MODEL=
AI_VISION_MODEL=
AI_TIMEOUT_MS=30000

OFF_ENABLED=false
USDA_ENABLED=false
USDA_API_KEY=
```

涉及 secret 的设置：
- ENV 中的值不显示原文；
- DB 保存时使用 AES-GCM；
- master key 来自 `APP_SECRET`；
- 日志永远 redact。

---

## 11. 数据库连接与稳定策略

SQLite 初始化：

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
```

关键写入使用事务。

建议每个 HTTP request 不长时间占用事务。

### 数据库锁策略
- 图片处理不放在事务内；
- AI 请求不放在事务内；
- 外部 API 请求不放在事务内；
- 先获取外部结果，再做短事务写入。

---

## 12. 缓存设计

不引入 Redis。

### 内存缓存
适合：
- 当天 dashboard；
- food details；
- system config；
- AI provider capabilities。

### SQLite read model
适合：
- 每日营养汇总；
- 30 天图表；
- 常用食物排名。

原则：
- 缓存是加速层，删除缓存后系统仍可正确计算；
- 不把唯一事实保存在缓存。

---

## 13. 前端架构

按 feature 分：

```text
features/
├─ dashboard/
├─ diary/
├─ food/
├─ recipe/
├─ body/
├─ activity/
├─ analytics/
├─ ai/
└─ settings/
```

每个 feature：

```text
feature/
├─ api.ts
├─ types.ts
├─ hooks.ts
├─ components/
└─ pages/
```

### 状态分类

#### TanStack Query
存：
- 食物数据；
- 日记；
- 体重；
- 统计；
- settings。

#### Zustand
只存：
- 当前 Add Food sheet 的临时状态；
- 手机底部 sheet 打开状态；
- chart display mode；
- 未提交筛选。

不要把服务端真实数据复制进 Zustand。

---

## 14. 响应式策略

### Mobile First
基准宽度：
- 360px；
- 390px；
- 430px。

### Breakpoints

```text
xs: 360
sm: 480
md: 768
lg: 1024
xl: 1280
2xl: 1536
```

### 布局切换

< 768：
- 底部导航；
- 单列卡片；
- full-width bottom sheet；
- sticky quick add。

768–1023：
- compact sidebar；
- 2 列可选。

>= 1024：
- 左侧 sidebar；
- 主 dashboard 双列；
- 统计卡片 2–3 列；
- 弹窗改 modal，不用全屏 sheet。

---

## 15. 错误处理

统一错误结构：

```json
{
  "error": {
    "code": "FOOD_NOT_FOUND",
    "message": "未找到该食物",
    "requestId": "..."
  }
}
```

错误分类：

- VALIDATION_ERROR
- NOT_FOUND
- CONFLICT
- DATASET_IMPORT_ERROR
- DATABASE_ERROR
- EXTERNAL_API_ERROR
- AI_PROVIDER_ERROR
- AI_RESPONSE_INVALID
- BACKUP_ERROR
- MIGRATION_ERROR

前端：
- 用户可修复错误：toast/inline；
- 数据可能损坏：阻止继续操作 + diagnostics；
- AI 错误：只影响 AI 区域，不弹全局灾难页。

---

## 16. 日志与诊断

结构化字段：

```text
timestamp
level
requestId
module
operation
durationMs
errorCode
```

禁止：
- API key；
- auth cookie；
- 完整 prompt 中的敏感个人记录（默认不日志）；
- 图片 base64。

提供 `/api/v1/system/diagnostics`：

```text
appVersion
schemaVersion
foodDatasetVersion
dbSize
walSize
uploadSize
backupCount
aiConfigured
offConfigured
lastMigration
lastBackup
```

---

## 17. 测试架构

### 单元测试
重点：
- nutrition-engine；
- recipe yield；
- serving conversion；
- energy target；
- MET；
- Adaptive TDEE；
- `Tr`/unknown handling。

### Repository integration test
使用临时 SQLite。

### API integration test
Fastify inject，无需真实端口。

### Frontend component test
Vitest + Testing Library。

### E2E
Playwright：

关键 golden flows：
1. 首次初始化；
2. 搜索馒头；
3. 加入早餐；
4. 修改克数；
5. 删除；
6. 记录体重；
7. 查看趋势；
8. AI provider 不可用时基本功能正常；
9. 备份；
10. restore 到新数据库。

---

## 18. 升级策略

语义化版本：

```text
MAJOR.MINOR.PATCH
```

每次容器启动：

```text
start
 ↓
检查 DB
 ↓
创建 pre-migration backup
 ↓
执行 migration
 ↓
migration validation
 ↓
启动 HTTP
```

如果 migration 失败：

```text
不启动写入服务
保留备份
输出恢复命令
```

### 数据集升级与程序升级分离

App：
```text
1.2.0
```

Food dataset：
```text
cfcd6-sanotsu-20260825-fixed-en
```

两者不能绑死。

---

## 19. Docker 架构

生产镜像使用 multi-stage：

```text
stage web-build
stage api-build
stage runtime
```

最终 runtime 仅包含：
- compiled API；
- web dist；
- migrations；
- runtime dependencies。

容器内部：

```text
Fastify :3000
 ├─ /api/*
 └─ static PWA
```

因此 Docker Compose 只需一个业务 service。

---

## 20. 参考架构与差异

### 借鉴 NutriTrace
- single-container；
- PWA；
- SQLite；
- optional AI；
- migrations；
- 本地数据。

### 借鉴 free-fitness
- AI provider 自配置；
- 同一业务对象复用分析；
- 模块备份；
- 中国食物数据。

### 本项目额外强化
- 明确模块 contract；
- 数据来源/版本/质量；
- nutrition snapshot；
- import staging；
- error taxonomy；
- migration safety；
- AI proposal boundary。

---

## 21. 最终原则

如果未来某个模块需要重写，应满足：

> 删除 `modules/ai` 不影响饮食；  
> 删除 `modules/activity` 不影响体重；  
> OFF 服务器挂掉不影响本地食物；  
> AI key 失效不影响 Dashboard；  
> 食物数据库升级不改变历史记录。

达到这些条件，才叫“模块化”。

---

## 22. 外部参考资料（开发时建议阅读）

- Sanotsu/china-food-composition-data: https://github.com/Sanotsu/china-food-composition-data
- Sanotsu/free-fitness: https://github.com/Sanotsu/free-fitness
- TraceApps/NutriTrace: https://github.com/TraceApps/nutritrace
- OpenNutriTracker: https://github.com/simonoppowa/OpenNutriTracker
- OpenNutriTracker Backend self-hosting: https://github.com/simonoppowa/OpenNutriTracker/blob/main/docs/supabase-self-hosting.md
- Fastify: https://fastify.dev/docs/latest/
- Drizzle SQLite / node:sqlite: https://orm.drizzle.team/docs/sqlite/connect-node-sqlite
- Node.js release schedule: https://nodejs.org/en/about/previous-releases

这些项目用于参考架构、交互和数据处理思路；本项目仍保持自己的模块边界、数据库 schema、UI 组件与计算引擎。
