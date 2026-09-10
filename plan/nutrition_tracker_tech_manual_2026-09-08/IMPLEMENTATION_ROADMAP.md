# Nutrition Tracker Implementation Roadmap

> 路线版本：v1.0  
> 建立时间：2026-09-09 06:30 +08:00  
> 跟踪入口：`DEVELOPMENT_PROGRESS.md`

**Goal:** 以可恢复、可追溯、可验收的纵向切片，交付个人自用的饮食与体重管理稳定版。

**Architecture:** React PWA + Fastify API + SQLite 的模块化单体，单业务容器部署。核心事实由确定性领域逻辑与本地数据库拥有，AI 和外部数据源均为可禁用适配器。

**Tech Stack:** Node.js 24 LTS、TypeScript、React 19、Vite、Fastify 5、Zod、SQLite、候选 Drizzle、Vitest、Testing Library、Playwright、Docker Compose。

**Specs:** `PRODUCT_SPEC.md`、`ARCHITECTURE.md`、`DATABASE_SCHEMA.md`、`API_SPEC.md`、`NUTRITION_ENGINE_SPEC.md`、`FOOD_DATA_SPEC.md`、`UI_DESIGN_SYSTEM.md`、`DOCKER_DEPLOYMENT.md`。

## 1. 全局约束

- 核心饮食、体重和统计功能不依赖互联网、AI、OFF 或 USDA。
- 日记营养值保存创建/修改时的快照，数据源升级不得改变历史。
- AI 不直接写业务表，必须 proposal → 用户确认 → application service。
- 数据库 migration 前必须产生可验证的备份；失败后禁止进入写入服务。
- 数据库时间存 UTC，日记边界使用用户 `timezone` 和 `local_date`。
- API、日志、备份和导出不得泄露 API Key、Cookie、Authorization 或密码 hash。
- V1 是 PWA shell 可缓存、服务器断网仍可运行；不是手机脱离服务器后的离线写入同步。
- 每个任务先更新 `DEVELOPMENT_PROGRESS.md`，完成前记录新鲜验收证据。
- 不跨里程碑“顺手实现”未进入范围的功能；新增需求先进入问题队列或决策记录。

## 2. 统一完成定义

单个任务标记 `DONE` 前必须满足：

1. 需求或 contract 有明确来源；
2. 正常路径、边界和错误路径有自动化测试；
3. 相关 lint、typecheck、test/build 命令退出码为 0；
4. API/DB/行为变化已同步规范；
5. 没有真实 secret 或个人健康数据进入仓库；
6. 进度文件记录验收命令、结果和后续动作。

仓库建立后应提供稳定脚本名：

```text
pnpm lint
pnpm typecheck
pnpm test
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm docker:smoke
```

里程碑可以增加专项命令，但不能用局部测试代替完整阶段验证。

## 3. M0 — 可验证基础

**目标：** 在编写主要业务前验证最昂贵的技术假设，并建立可迁移、可恢复、可鉴权的运行骨架。

**入口条件：** 当前 8 份规范、审查文档和路线图已建立基线。

### M0-001 版本控制与工作区基线

**交付：** 初始化 Git；建立 `.gitignore`、pnpm workspace、Node/pnpm 固定版本、根脚本和基础目录。

**验收：** 干净安装后 `pnpm install --frozen-lockfile`、`pnpm lint`、`pnpm typecheck`、`pnpm build` 可重复通过；仓库不包含 `.env`、`/data`、构建产物和真实上传文件。

### M0-002 SQLite/ORM 技术门

**依赖：** M0-001。

**交付：** 对 `node:sqlite + Drizzle` 建立最小 spike；以 ADR 记录选择或切换 `better-sqlite3` 的原因。

**必须验证：** WAL、foreign keys、busy timeout、事务回滚、并发写冲突、FTS5、migration、原生 backup API、`integrity_check`、amd64/arm64 Docker build。

**通过标准：** 所有验证有自动化脚本；备份在写入期间仍可恢复一致数据；不依赖未锁定版本；若 Drizzle 的 `node:sqlite` adapter 仍需不可接受的 RC 依赖，则采用备选驱动。

### M0-003 Core contracts

**依赖：** M0-001。

**交付：** 统一 ID、Clock、timezone/local-date、错误 taxonomy、配置优先级、secret redaction、request ID 和 shared Zod contract 规则。

**验收：** clock/ID 可在测试中替换；非法 timezone、配置缺失和 secret 输出均有测试；API error envelope 与规范一致。

### M0-004 Schema 与 migration 基线

**依赖：** M0-002、M0-003。

**交付：** 首批 core/profile 表，完整 DDL 约束，forward-only migration runner，schema checksum 和历史 DB fixtures。

**必须包含：** bootstrap 状态、session 或签名 session 决策、idempotency record、job run lock、audit log、migration history。

**验收：** 空库、上一 fixture、重复启动、失败 migration、foreign key 检查和 checksum 不匹配用例通过。

### M0-005 Backup/restore 最小闭环

**依赖：** M0-004。

**交付：** CLI 形式的 create/verify/restore；manifest、SHA-256、pre-migration/pre-restore backup、maintenance lock、临时目录恢复与失败回滚。

**验收：** 运行中备份可恢复到临时目录；损坏 archive、checksum 不符、schema 过新被拒绝；恢复失败后原 DB/uploads 保持一致。

### M0-006 首次初始化与鉴权

**依赖：** M0-003、M0-004。

**交付：** 未初始化状态查询、一次性 bootstrap、密码 hash、login/logout/session、cookie 安全属性、origin check、登录限流和 session 轮换/失效。

**验收：** 初始化只能成功一次；未鉴权不能访问业务 API；trusted LAN 模式必须显式开启；密码和 cookie 不进入日志。

### M0-007 可执行容器与 CI

**依赖：** M0-004、M0-005、M0-006。

**交付：** 完整 multi-stage Dockerfile、non-root runtime、Compose、health/readiness、SIGTERM 优雅停机、结构化日志和 CI 基线。

**验收：** 新 `/data` 一键启动；重启数据不丢；health 不依赖 AI/外网；容器在迁移前不 ready；Docker smoke test 自动通过。

**M0 退出门槛：** 从空目录启动、初始化、登录、生成备份、恢复、重启均通过；SQLite 技术选择有 ADR；完整基础测试和 Docker smoke 命令退出码为 0。

## 4. M1 — 饮食记录纵向切片

**目标：** 完成“导入真实食物 → 搜索 → 选择份量 → 营养计算 → 写入日记快照 → Dashboard 更新”的可用闭环。

**入口条件：** M0 关闭；中国食物数据仅以本地测试 seed/fixture 使用，授权风险已记录。

### M1-001 Nutrition Engine 基础

**交付：** nutrient scaling、g/ml/serving 换算、edible portion、unknown/trace/estimated、coverage、rounding policy 和版本常量。

**验收：** `NUTRITION_ENGINE_SPEC` 中全部 golden calculation tests 固定化；引擎无 DB、网络、环境变量和系统时间依赖。

### M1-002 Food canonical schema

**依赖：** M1-001。

**交付：** dataset、item、source record、nutrient definition/value、alias、serving、search stats 和 staging 表的完整 schema。

**验收：** raw string 保真；`Tr`、`—` 不变成 0；active dataset、canonical key、source relation 和删除行为有约束测试。

### M1-003 Food import pipeline

**依赖：** M1-002。

**交付：** parse → staging → structural/semantic validation → normalization → diff → transactional promote → reindex。

**验收：** 同版本重复导入不重复；失败不改变 active catalog；20–50 个 golden foods 验证 code、macro、raw、alias 和 serving。

### M1-004 Food search/detail API

**依赖：** M1-003。

**交付：** 本地精确名、别名、拼音首字母、最近、常用排序；food detail、custom food、alias、serving 和 favorite contracts。

**验收：** 固定 1,677 和 100k 数据 fixtures 报告 p50/p95；本地搜索 p95 小于 100ms；无本地结果时也不自动触发 AI。

### M1-005 Diary domain 与 snapshot

**依赖：** M1-001、M1-002。

**交付：** day、meal slot、entry、entry nutrient snapshot、copy meal/day、幂等写入和 optimistic concurrency。

**验收：** 食物修改/停用后历史值不变；重复 Idempotency-Key 不新增记录；版本冲突返回 409；复制规则覆盖原 food 不存在情形。

### M1-006 Dashboard read model

**依赖：** M1-005。

**交付：** 当日目标、摄入、宏量、coverage、meal totals、剩余热量和可重建 daily summary。

**验收：** cache 删除后可重建且结果一致；Dashboard 本地查询 p95 小于 100ms；goal snapshot 不被新目标覆盖。

### M1-007 Mobile-first 核心 UI

**依赖：** M1-004、M1-006。

**交付：** 首次设置、登录、Dashboard、食物搜索、数量编辑、餐次管理、编辑/复制/删除记录、空/加载/错误/offline 状态。

**验收：** 360/390/430px 无横向溢出；键盘、focus trap、44px hit area、reduced motion 和非颜色状态表达通过；视觉基线截图已建立。

### M1-008 核心 E2E 与数据安全

**依赖：** M1-007。

**交付：** 初始化、导入、搜索馒头、加入早餐、修改克数、复制、删除、重启和历史不漂移的 Playwright/集成流程。

**验收：** AI disabled、无互联网和容器重启场景通过；备份可以恢复该流程产生的数据。

### M1-010 测试期远程食物目录导入

**依赖：** M1-003、M1-008。

**交付：** 从可配置的用户 fork 拉取 fixed-en JSON 目录，合并为受控 manifest，计算 checksum 后通过现有 staging/promote 导入；仅在启动前执行一次，不让搜索请求依赖 GitHub。

**验收：** 远程目录过滤/合并/checksum、重复导入幂等、失败不覆盖既有 active dataset；Compose 启动前导入和本地搜索回归通过。

**M1 退出门槛：** 从空数据目录部署后，用户可不依赖互联网完成一天饮食记录；性能、快照、备份恢复和四个目标 viewport 均有通过证据。

## 5. M2 — 目标、体重与基础分析

**目标：** 用版本化目标和体重趋势形成可解释的基础分析闭环。

### 任务

- **M2-001 Profile 与目标版本：** BMR/TDEE、手动覆盖、macro 目标、effective range、历史 goal snapshot。
- **M2-002 体重记录：** 同日多次记录、趋势采样策略、BMI 信息展示、编辑/删除冲突。
- **M2-003 趋势引擎：** 7/14/30/90 天 rolling/EWMA、版本参数和缺失数据规则。
- **M2-004 Analytics read model：** 平均摄入、目标差异、宏量、记录 coverage、体重变化。
- **M2-005 Adaptive TDEE v1：** 21/28 天门槛、8–10 个体重点、confidence、7 天更新节流和不自动改目标。
- **M2-006 UI/E2E：** 目标、体重、趋势和分析页面；数据不足、异常值和算法版本状态。

**M2 退出门槛：** 固定模拟数据得到确定趋势/TDEE；数据不足不会伪造估算；修改当前目标不改变历史 Dashboard；30 天趋势 p95 小于 150ms。

## 6. M3 — 菜谱、运动与预算策略

**目标：** 支持多原料菜谱和手动运动，同时保持计算来源可追溯。

### 任务

- **M3-001 菜谱数据决策：** 落实 ingredient nutrition snapshot、cache 失效和 food projection 单向关系。
- **M3-002 菜谱计算与 API：** total/per100g/perServing、cooked yield、复制、编辑、删除、加入日记。
- **M3-003 菜谱 UI/E2E：** 原料搜索、重量、成品重量、份数、warnings 和历史快照验证。
- **M3-004 运动计算与数据：** MET、固定消耗、weight/MET/formula snapshot。
- **M3-005 运动预算策略：** `display_only/eat_back_50/eat_back_100` 设置版本化并进入当日目标计算。
- **M3-006 运动 UI/E2E：** 添加、编辑、删除、Dashboard 展示和双重计算提示。
- **M3-007 Data Garden 全站 UI 重构：** 依据 `UI_DESIGN_SYSTEM.md` 统一 AppShell、桌面三栏、移动端重排、六个页面、按钮语义、状态、无障碍和视觉回归；不改变 API、数据库和快照事实边界。
- **M3-008 饮食分餐快捷添加：** 在四个餐次摘要提供快捷添加入口，复用统一本地搜索/份量确认流程，自动预选目标餐次；不改变 API、数据库和营养计算边界。
- **M3-009 今日热量摘要：** 完善今日页热量卡；无饮食记录时显示 0 摄入与剩余预算，超预算时不显示负剩余并解释超出量，无目标时保持明确不可用状态。

**M3 退出门槛：** 菜谱和运动所有 golden formulas 通过；修改原食物/MET/体重不改变既有日记或运动快照；默认不吃回运动热量；M3-007 的桌面/移动端 UI 与可访问性验收通过。

## 7. M4 — 可选 AI

**目标：** 在完全不改变核心事实边界的前提下增加文本、图片和解释能力。

### 任务

- **M4-001 Provider lifecycle：** create/update/test/disable/delete、ENV 覆盖、capabilities、加密与日志 redact。
- **M4-002 安全适配层：** timeout、重试上限、SSRF 防护、private network 显式开关、rate limit。
- **M4-003 Structured output：** 文本饮食、餐照、日/周分析 Zod schema；最多一次 repair。
- **M4-004 Proposal lifecycle：** payload version、目标日期/餐次、expiry、stale food 检查、重复确认幂等。
- **M4-005 Context/cache：** 最小化上下文、context hash、缓存失效、隐私日志规则。
- **M4-006 UI/E2E：** provider 设置、候选编辑/确认、图片不确定性、失败降级、AI disabled。

**M4 退出门槛：** AI 断网、401、timeout、非法 JSON、无 vision、重复确认和恶意 base URL 测试通过；关闭 AI 后 M1–M3 全部核心流程仍通过。

## 8. M5 — 稳定化与 v1.0 发布

**目标：** 完成长期自用所需的可运维性、PWA 体验和发布验证。

### 任务

- **M5-001 Backup UI 与保留策略：** daily/weekly/monthly retention、下载、验证、危险恢复确认。
- **M5-002 Diagnostics/maintenance：** DB/WAL/uploads、schema/dataset、last backup、reindex、orphan cleanup、`PRAGMA optimize`。
- **M5-003 PWA：** manifest、图标、app shell 缓存、升级提示、offline banner；不缓存 mutation。
- **M5-004 Desktop 完整适配：** 1024/1440 viewport、sidebar、双列 Dashboard 和 modal 行为。
- **M5-005 安全与供应链：** dependency audit、SBOM、容器最小权限、上传/解压限制、secret scan。
- **M5-006 历史迁移矩阵：** 所有 release fixtures 升级、失败恢复、旧版本回滚演练。
- **M5-007 多架构发布：** linux/amd64、linux/arm64、固定 tag、release notes 和干净主机演练。
- **M5-008 文档收口：** 安装、升级、回滚、备份恢复、故障排除、数据来源授权说明。

**M5 退出门槛：** `DOCKER_DEPLOYMENT.md` 上线 checklist 全部附证据；干净主机完成安装—使用—升级—回滚—恢复演练；完整 CI/E2E/migration/multi-arch build 通过。

## 9. 需求追踪矩阵

| 产品能力 | 主要任务 | 核心证据 |
|---|---|---|
| 首次设置/鉴权 | M0-006、M1-007 | bootstrap/auth integration + E2E |
| 中国食物导入 | M1-002、M1-003 | golden food + promote rollback tests |
| 食物搜索/自定义/份量/别名 | M1-004、M1-007 | API integration + latency + E2E |
| 饮食日记/复制/快照 | M1-005、M1-008 | snapshot/idempotency/conflict + E2E |
| Dashboard | M1-006、M1-007 | read-model correctness + visual regression |
| 目标/体重/分析 | M2-001 至 M2-006 | golden trend/TDEE + E2E |
| 菜谱 | M3-001 至 M3-003、M3-007 | recipe yield/snapshot + E2E + unified UI |
| 运动 | M3-004 至 M3-006 | MET/budget mode + E2E |
| AI 文本/图片/总结 | M4-001 至 M4-006 | schema/proposal/security/degradation tests |
| 备份恢复/迁移 | M0-004、M0-005、M5-001、M5-006 | historical fixtures + disaster drill |
| PWA/响应式 | M1-007、M5-003、M5-004 | viewport screenshots + offline behavior |
| Docker/发布 | M0-007、M5-005、M5-007 | smoke + SBOM + multi-arch build |

## 10. 明确不进入 v1.0 的内容

- 多用户、RBAC、社交、排行榜和云账户；
- Health Connect、Apple Health、Garmin/Fitbit 双向同步；
- 客户端完全离线写入及冲突同步；
- 微服务、Kubernetes、Redis 或 Elasticsearch 强依赖；
- AI 未经确认自动写入；
- Dark Mode、围度管理、OCR 自动建档和外部数据源大规模镜像。

上述内容如果重新进入范围，必须创建决策记录并重新评估数据模型、隐私和路线依赖。
