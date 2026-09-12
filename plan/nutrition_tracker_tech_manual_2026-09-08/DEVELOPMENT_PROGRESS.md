# 开发进度实时记录

> 这是项目状态的单一事实源。  
> 更新模式：事件驱动——任务开始、阻塞、恢复、完成和交接时立即更新。  
> 项目时区：Asia/Shanghai（UTC+08:00）  
> 最后更新：2026-09-12 16:27 +08:00

## 1. 当前快照

| 项目 | 当前值 |
|---|---|
| 项目阶段 | M3 菜谱、运动与预算策略实施 |
| 总体状态 | `IN_PROGRESS` |
| 当前里程碑 | M3 — 菜谱、运动与预算策略 |
| 当前焦点 | M3-013 写入状态与幂等重试（待开始） |
| 下一步 | 按审核修正队列独立执行 M3-013；原运动计划保留 |
| 当前阻塞 | 无环境阻塞；本机 Docker CLI 仍缺失，仅影响容器实测，不影响 CI buildx |
| 业务代码 | 既有功能基础上，M3-012 会话恢复与统一加载已完成；M3-013～020 为审核修正队列 |
| Git | 分支 `codex/m3-012-session-loading`，提交 `020e80e` 已推送至 `origin/codex/m3-012-session-loading`；等待合并到 `main` |

> “实时”表示每次状态事件即时写入本文件，不表示后台定时器自动采集。后续接手者应先读本页，再执行任何任务。

## 2. 里程碑概览

| 里程碑 | 目标 | 状态 | 完成任务 | 退出门槛 |
|---|---|---:|---:|---|
| DOC | 审查方案并建立可交接路线 | `DONE` | 2/2 | 新增文档可读、互链、结构与任务统计检查通过 |
| M0 | 可验证基础 | `DONE` | 7/7 | 初始化、鉴权、迁移、备份恢复、容器 smoke 与多架构构建全部通过 |
| M1 | 饮食记录纵向切片 | `DONE` | 10/10 | 饮食记录闭环、远程测试目录 bootstrap 与本地导入验证通过 |
| M2 | 目标、体重与基础分析 | `DONE` | 6/6 | 趋势/TDEE 确定性且历史目标不漂移 |
| M3 | 菜谱、运动与预算策略 | `IN_PROGRESS` | 7/10 | M3-003、M3-007、M3-008、M3-009、M3-010 与 DOC-005 已完成；M3-011 额外 UI 增强已完成，下一步 M3-004 |
| M4 | 可选 AI | `PLANNED` | 0/6 | AI 失败不影响核心，写入始终需确认 |
| M5 | 稳定化与 v1.0 发布 | `PLANNED` | 0/8 | 安装、升级、回滚、恢复和多架构发布演练通过 |

## 3. 当前任务

### DOC-006 — 功能与操作逻辑审核及修改规划

- 状态：`DONE`
- 开始时间：2026-09-12 11:47 +08:00
- 操作者：Codex
- 范围：六页前端、API 连接、日期/目标/趋势语义、异常恢复、验收覆盖与规划一致性。
- 计划验收：核查源码定位、任务 ID 唯一性、规划内部链接与 `git diff --check`；只修改审核与规划文档。
- 完成时间：2026-09-12 11:52 +08:00
- 当前进展：已形成 11 项源码审核发现、11 个独立规划任务及故障/浏览器验收矩阵；README 与路线已链接报告。未修改业务代码，未执行动态或视觉验收，风险推断不等同于运行复现。
- 验收结果（EVD-DOC-006）：`git -c safe.directory='D:/AI编程/体重管理' diff --check` 通过；PowerShell 正则核对 11 个任务 ID 唯一且均映射进度表、Test-Path 检查四份文档目标存在，通过，退出码 0。Git 仅提示 LF/CRLF 转换警告。
- 活动日志：2026-09-12 11:47 +08:00，Codex 开始源码审核及规划，计划验收为源码定位/任务 ID/文档链接/diff 检查；2026-09-12 11:52 +08:00，完成文档检查并交接。
- 下一步：建议 M3-012；详见 FUNCTION_AUDIT_AND_REMEDIATION.md。本次 DONE 仅指审核与规划，修正任务全部 PLANNED。

### 审核修正队列（DOC-006 建议）

以下为新增规划，不代表已修复；完成标准和依赖见 [审核报告](./FUNCTION_AUDIT_AND_REMEDIATION.md)。原里程碑计数为历史口径，待 DOC-007 按稳定 ID 统一重算，不将新增规划计作完成。

| ID | 状态 | 任务 |
|---|---|---|
| M3-012 | `DONE` | 会话恢复与统一加载 |
| M3-013 | `PLANNED` | 写入状态与幂等重试 |
| M3-014 | `PLANNED` | 日期选择、历史补录与时区 |
| M3-015 | `PLANNED` | 资料与目标编辑 |
| M3-016 | `PLANNED` | 趋势窗口与查询正确性 |
| M3-017 | `PLANNED` | 统一分餐添加组件与错误恢复 |
| M3-018 | `PLANNED` | 体重纠错和历史列表 |
| M3-019 | `PLANNED` | 食物详情、分页、自定义与最近使用 |
| M3-020 | `PLANNED` | 分析语义、热量环与真实状态 |
| M5-009 | `PLANNED` | 备份恢复入口及 NAS 升级演练 |
| DOC-007 | `PLANNED` | 状态治理与需求验收矩阵 |

### M3-012 — 会话恢复与统一加载

- 状态：`DONE`
- 开始时间：2026-09-12 11:54 +08:00
- 操作者：Codex
- 决策：已有会话、显式登录、设置完成共用读取 profile/goals 后的入口，按返回的用户时区加载今日；仅 401/未认证转登录，服务失败显示可重试状态；异步读取仅最新有效请求可更新视图，卸载/退出失效。无需变更数据库或 HTTP contract。
- 范围：App 会话与汇总加载、面板读取竞态、浏览器故障回归；不混入写入幂等（M3-013）和日期选择（M3-014）。
- 活动日志：2026-09-12 11:54 +08:00，Codex 开始；当前目录分支 codex/m3-012-session-loading，保留审核文档。
- 计划验收：新增 Playwright 回归先红后绿；pnpm lint/typecheck/test/build/api:smoke/test:e2e；git diff --check。
- 完成时间：2026-09-12 16:23 +08:00
- 实现：已有会话、登录、设置完成统一执行 profile/goals/readDashboard；使用资料时区计算日期；新增独立读取失败页和重新加载；仅 401 清理会话并转登录；以会话请求、仪表盘请求、页面代次及各面板请求序号阻止迟到结果覆盖当前视图。失败的退出不会遗留永久加载，体重写入后的迟到刷新不会抢占分析读取。
- 验收结果（EVD-M3-012-A）：新增 9 个 Playwright 场景，修改前 7 个核心场景中 5 失败、1 通过，新增两项竞态均失败；修改后专项 9/9 通过。最终 `pnpm lint`、`pnpm typecheck` 退出码 0；`pnpm test` 183 files/1076 tests 通过；`pnpm build` 通过；`pnpm api:smoke` home/health/ready 均 200；`pnpm test:e2e` 11/11 通过；`git diff --check` 通过（仅 CRLF 转换警告）。
- 复核：独立代码复核发现退出失败和跨页体重刷新两项请求归属竞态；均新增先失败后通过的浏览器测试并修正。复核代理随后因账户用量限制结束，不影响已返回的具体发现及本地全量验收。
- 活动日志追加：2026-09-12 16:27 +08:00，Codex 将提交 `020e80e` 推送至 GitHub 分支 `codex/m3-012-session-loading`；远端提示可创建 PR，尚未合并 `main`。
- 下一步：合并到 `main` 后，再独立执行 M3-013 写入状态与幂等重试。

### M0-004 — Schema 与 migration 基线

- 状态：`DONE`
- 开始时间：2026-09-09 07:08 +08:00
- 完成时间：2026-09-09 07:20 +08:00
- 操作者：Codex
- 依赖：M0-002（候选驱动，Docker 门暂缓）、M0-003
- 计划变更：定义 core/profile、session、幂等和 job lock schema，并让 migration runner 接受真实 migration 列表
- 计划验收：空库、上一 fixture、重复启动、失败 migration、foreign key 和 checksum 测试
- 当前进展：已完成 core/profile、session、幂等、job lock 表和约束；空库 bootstrap、重复启动、失败 migration、foreign key、checksum 均有测试
- 验收结果：EVD-M0-004-A；全量门禁通过，4 个 test files、16 个 tests passed
- 下一步：进入 M0-005，补备份 manifest、完整性校验和原子恢复

### M0-005 — Backup/restore 最小闭环

- 状态：`DONE`
- 开始时间：2026-09-09 07:20 +08:00
- 完成时间：2026-09-09 07:27 +08:00
- 操作者：Codex
- 依赖：M0-004
- 计划变更：实现 SQLite 在线备份、manifest/checksum 校验和安全恢复入口
- 计划验收：备份可重开、manifest 可验证、损坏备份拒绝恢复、恢复失败不覆盖现有数据库
- 当前进展：已实现在线备份、manifest 原子写入、SHA-256/字节数校验、SQLite integrity_check 与安全恢复临时文件
- 验收结果：EVD-M0-005-A；5 个 test files、18 个 tests passed；lint/typecheck/build 通过
- 下一步：进入 M0-006，定义 bootstrap once、密码哈希和有状态 session

### M0-006 — 首次初始化与鉴权

- 状态：`DONE`
- 开始时间：2026-09-09 07:27 +08:00
- 完成时间：2026-09-09 07:35 +08:00
- 操作者：Codex
- 依赖：M0-003/004/005
- 计划变更：实现首次用户 bootstrap、密码哈希、登录和数据库 session 生命周期
- 计划验收：bootstrap 只成功一次、密码不落明文、错误不泄露用户存在性、session 可撤销且过期
- 当前进展：已实现一次性 bootstrap、scrypt password hash、统一凭据错误、数据库 session、过期/撤销和安全 cookie 默认值
- 验收结果：EVD-M0-006-A；6 个 test files、22 个 tests passed；lint/typecheck/build 通过
- 下一步：进入 M0-007，补可执行容器与 CI 基线

### M0-007 — 可执行容器与 CI

- 状态：`DONE`
- 开始时间：2026-09-09 07:35 +08:00
- 完成时间：2026-09-09 08:20 +08:00
- 操作者：Codex
- 依赖：M0-004/005/006
- 计划变更：补 non-root 多阶段 Dockerfile、Compose、health/readiness、SIGTERM 和 CI 基线
- 计划验收：Docker build/run/smoke、数据目录持久化、健康检查和构建门禁
- 当前进展：已完成 Dockerfile、Compose、healthcheck、SIGTERM 关闭路径和 CI buildx 配置；针对飞牛启动失败补上 API workspace 依赖复制，并在 Compose 启动时修正 bind mount 所有权后降权运行
- 验收结果：EVD-M0-007-D/E/G；新修复远程 verify、buildx 与 GHCR 发布成功
- 下一步：飞牛执行强制 pull、重建并检查 `/healthz`；若仍失败再收集容器日志

### M1-001 — Nutrition Engine 基础

- 状态：`DONE`
- 开始时间：2026-09-09 08:20 +08:00
- 完成时间：2026-09-09 10:00 +08:00
- 操作者：Codex
- 依赖：M0
- 计划变更：实现 nutrient scaling、g/ml/serving 换算、edible portion、unknown/trace/estimated、coverage、rounding policy 和版本常量
- 计划验收：`NUTRITION_ENGINE_SPEC` 全部 golden calculation tests 固定化；引擎不依赖 DB、网络、环境变量和系统时间
- 当前进展：review P1 已修复；estimated 继续数值求和且设置 metadata，但仅 known 计入 coverage 分子
- 验收结果：EVD-M1-001-B；修复用例先以 0.625 失败，再以 0.5 通过；聚焦 6 tests、全量 7 test files/28 tests、lint/typecheck/build 均通过
- 下一步：进入 M1-002 Food canonical schema

### M1-002 — Food canonical schema

- 状态：`DONE`
- 开始时间：2026-09-09 10:05 +08:00
- 完成时间：2026-09-09 18:20 +08:00
- 操作者：Codex
- 依赖：M1-001
- 计划变更：补 food_dataset、food_item、food_category、food_source_record、food_nutrient_definition、food_nutrient_value、food_alias、food_serving、food_search_stats 和 FTS 基线表/约束
- 计划验收：raw string 保真；`Tr`、`—` 不变成 0；active dataset、canonical key、source relation、nutrient status、serving 与删除行为有约束测试
- 当前进展：已为 source-record/food 与 staging-item/dataset 增加复合唯一键和复合外键；错配回归测试先 RED 后 GREEN
- 验收结果：EVD-M1-002-A/B；聚焦 1 test file/7 tests、全量 8 test files/35 tests，lint/typecheck/integration/build/API smoke 均通过；docker smoke 以 Docker CLI 缺失提示退出 0
- 下一步：进入 M1-003 Food import staging pipeline

### M1-003 — Food import staging pipeline

- 状态：`DONE`
- 开始时间：2026-09-09 18:25 +08:00
- 完成时间：2026-09-09 20:30 +08:00
- 操作者：Codex + delegated implementer
- 依赖：M1-002
- 计划变更：实现受控 raw JSON 导入、staging 写入、结构/语义校验、规范化、active diff、事务 promote 与可审计报告；失败不得改变 active catalog
- 计划验收：TDD RED/GREEN；20–50 个 golden foods 覆盖 code、macro、raw、alias、serving；重复版本幂等；失败隔离；promote 回滚；全量 lint/typecheck/test/integration/build/API smoke/docker smoke
- 当前进展：已修复两轮独立复审的 5 项 Important 问题：`kJ` unit/source remark、结构失败 staging 审计、无穷/非法数值拒绝、已 promoted identity 不可降级；20 条 synthetic golden fixture 覆盖完整导入闭环
- 验收结果：EVD-M1-003-A/B；聚焦 2 files/16 tests、全量 13 files/64 tests，lint/typecheck/integration/build/API smoke 全部 exit 0；docker smoke 明确记录本机 Docker CLI 缺失
- 阻塞/风险：真实外部 CFCD 数据不随仓库引入；使用受控 golden fixtures 验证 importer contract
- 下一步：进入 M1-004 Food search/detail API

### M1-004 — Food search/detail API

- 状态：`DONE`
- 开始时间：2026-09-09 20:35 +08:00
- 完成时间：2026-09-09 21:10 +08:00
- 操作者：Codex + delegated implementer
- 依赖：M1-003
- 计划变更：实现本地搜索、detail、custom food、alias、serving、favorite contracts，并接入 API；无本地结果不得触发 AI/外部网络
- 计划验收：TDD RED/GREEN；精确名/别名/前缀/FTS、inactive 过滤、cursor、raw/status detail、custom/reference 编辑边界、alias/serving 校验、favorite 幂等与无网络空结果；全量门禁
- 当前进展：已完成三轮复审修复：新增 `0005/0006` search key/NOCASE 前向索引、PATCH runtime validation、optional nutrient revision upsert，并将 search cursor 固定为 `meta.nextCursor`；聚焦 3 files/15 tests、全量 28 files/137 tests 和本地门禁均通过。
- 阻塞/风险：未测量 1,677/100k 的 p50/p95，不宣称 <100ms；当前搜索使用 indexed name/alias SQL，FTS/pinyin 的性能策略需在基准任务中量化。
- 下一步：进入 M1-005 Diary domain 与 snapshot

### M1-005 — Diary domain 与 snapshot

- 状态：`DONE`
- 开始时间：2026-09-09 21:15 +08:00
- 完成时间：2026-09-09 21:40 +08:00
- 操作者：Codex + delegated implementer
- 依赖：M1-001、M1-004
- 计划变更：增加 `0007_diary_snapshots` 前向迁移、日记 domain 和核心 REST 读写路径；以存储快照保持历史不随 food 更新或停用而漂移。
- 计划验收：TDD RED/GREEN；快照缩放、food edit/deactivation 后历史稳定、幂等、乐观锁、copy fallback、事务回滚与 API error envelope；全量门禁。
- 当前进展：`diary_day`、默认餐次、entry/version 与每营养快照已在同一事务落库；`0008` 记录 `serving_id`；day read 返回基于存储快照的 meal/daily totals 与 coverage；copy-day/copy-meal 均优先当前 active food，缺失/停用时使用 `copy_snapshot`。
- 验收结果：EVD-M1-005-A/B/C；最终聚焦 diary/API 2 files/9 tests、全量 51 files/258 tests；lint/typecheck/integration/build/API smoke 均 exit 0；Docker smoke 如实报告本机 Docker CLI 缺失并 exit 0；独立复审无 Critical/Important/Minor。
- 阻塞/风险：菜谱、照片、goal snapshot、Dashboard/UI 与外部调用均未扩展到本任务；API 当前以基础单用户 `local-user` 承载，后续鉴权路由应接入 session user。
- 下一步：进入 M1-006 Dashboard read model。

### M1-006 — Dashboard read model

- 状态：`DONE`
- 开始时间：2026-09-09 21:45 +08:00
- 完成时间：2026-09-09 22:15 +08:00
- 操作者：Codex
- 依赖：M1-005
- 计划变更：从 diary 已存营养快照构建当日 Dashboard 与可重建 `analytics_daily_summary`；按日期固定目标快照，不重算历史 food 数据。
- 计划验收：TDD RED/GREEN；Dashboard API envelope、meal/intake/macros/coverage/remaining、缓存删除后重建一致、目标变更不覆盖历史；全量门禁与本地查询基准证据。
- 当前进展：新增 `0009_analytics_daily_summary`、日期创建时的 `goal_id` 绑定、Dashboard domain 与 `GET /api/v1/dashboard/:date`；只消费已存 diary 快照，支持删除缓存后重建；目标 CRUD 留给 M2-001。
- 验收结果：EVD-M1-006-A；聚焦 domain/route 2 files/4 tests；全量 94 files/505 tests；lint/typecheck/integration/build/API smoke 均 exit 0；本地 1000 次 warm SQLite 查询 p50 0.321ms、p95 0.573ms；独立复审无 Critical/Important/Minor；Docker CLI 缺失由 smoke 如实记录。
- 阻塞/风险：运动与体重仍为明确 no-data 字段，目标写入 API 留给 M2-001；M1-007 仍需实现前端。
- 下一步：进入 M1-007 Mobile-first 核心 UI。

### M1-007 — Mobile-first 核心 UI

- 状态：`DONE`
- 开始时间：2026-09-09 22:20 +08:00
- 完成时间：2026-09-10 07:05 +08:00
- 操作者：Codex
- 依赖：M1-004、M1-006
- 计划变更：在 `apps/web` 建立 React/Vite 前端，接入 bootstrap、login/logout/session、profile/goal、food search、diary 和 Dashboard API，完成首次设置、登录和移动端核心记录流程与可访问状态。
- 计划验收：360/390/430px 无横向溢出；键盘/focus trap/44px hit area/reduced motion/非颜色状态表达；Dashboard 视觉基线、空/加载/错误/offline 状态。
- 当前进展：首次设置、登录/退出、目标设置、Dashboard、受控食物搜索、快速记账、记录编辑/删除、复制昨日整天/单餐和 360/390/430 响应式浏览器验收已通过；复用现有 PATCH/DELETE/copy API，不新增迁移，历史 diary snapshot 语义保持不变。
- 活动日志：2026-09-10 06:55 +08:00 开始记录操作补齐；2026-09-10 07:05 +08:00 完成验收，操作者 Codex。
- 验收结果：EVD-M1-007-F；全量 138 files/733 tests、lint/typecheck/build/API smoke、Playwright 1 passed、编辑/删除/复制流程与 360/390/430 无横向溢出通过。
- 阻塞/风险：无；本机 Docker CLI 缺失仍只影响容器实测。
- 下一步：进入 M3-001，先确认菜谱 ingredient nutrition snapshot 与重算边界。

### M1-008 — 核心 E2E 与数据安全

- 状态：`DONE`
- 开始时间：2026-09-10 00:24 +08:00
- 操作者：Codex
- 依赖：M1-007 功能路径已完成；目标 viewport 视觉证据仍待补齐
- 计划变更：新增无需公网的 API 集成 golden flow，覆盖初始化、受控食物导入、搜索馒头、早餐记录、克数修改、复制、删除、重启、历史快照稳定和备份恢复。
- 计划验收：TDD RED/GREEN；单个临时 SQLite 完成全流程；重启后 session 可重新登录；food 版本变化不漂移历史 diary snapshot；恢复数据库后流程数据可读。
- 完成时间：2026-09-10 00:28 +08:00
- 当前进展：已新增真实 HTTP + SQLite golden flow，覆盖一次初始化、受控馒头数据导入/搜索、早餐记录、数量修改、复制、删除、服务重启、food v2 更新后的历史快照稳定，以及 backup manifest/restore 后数据可读。
- 验收结果：EVD-M1-008-A；聚焦 1 file/1 test、全量 106 files/539 tests；lint/typecheck/build/API smoke/git diff check exit 0；docker smoke exit 0 但本机无 Docker CLI。
- 阻塞/风险：当前仓库未引入 Playwright 浏览器运行时；集成测试已覆盖同一 golden flow，浏览器级 E2E 与容器真实重启演练仍需后续环境补齐。
- 下一步：进入 M1-009，先消除导航和搜索空状态的不可观察交互。

### M1-009 — 导航交互与食物搜索空状态

- 状态：`DONE`
- 开始时间：2026-09-10 00:55 +08:00
- 完成时间：2026-09-10 01:05 +08:00
- 操作者：Codex
- 依赖：M1-007、M1-008
- 计划变更：增加类型化 Dashboard 导航状态；实现今日/饮食/我的页面壳；为体重/分析提供明确 M2 占位；补充食物搜索 loading/empty/error 可见状态和本地目录导入说明。
- 计划验收：先测试后实现；Web 聚焦测试、全量 `pnpm test`、`pnpm lint`、`pnpm build`、`pnpm api:smoke`、`git diff --check` 全部通过；不引入外部网络或数据库迁移。
- 当前进展：导航状态模型、Dashboard 五项导航、M2 占位页、搜索 loading/empty/error 状态和本地目录导入说明均已完成；登录后完整用户会话现在会先加载 Dashboard 数据再进入首页。
- 验收结果：EVD-M1-009-A；聚焦 Web dashboard/flow/search-state 3 files/8 tests；全量 108 files/544 tests；lint/build/typecheck/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用。
- 阻塞/风险：无功能阻塞；360/390/430 视觉基线与浏览器级 E2E 仍归 M1-007 后续验收。
- 下一步：回到 M1-007，完成目标 viewport 视觉证据。

### M1-010 — 测试期远程食物目录导入

- 状态：`DONE`
- 开始时间：2026-09-10 20:20 +08:00
- 完成时间：2026-09-10 20:40 +08:00
- 操作者：Codex
- 依赖：M1-003、FOOD_DATA_SPEC.md、DOCKER_DEPLOYMENT.md §22
- 计划变更：从 `ruoshui6662/china-food-composition-data` 的 fixed-en JSON 目录拉取并合并食物记录，生成带来源与 checksum 的 manifest，复用现有 staging/promote 导入；只在容器启动前执行一次，搜索仍只访问本地 SQLite。
- 计划验收：远程目录过滤/合并/checksum、重复导入幂等、失败不覆盖既有 active dataset；Compose 启动前导入；focused tests、全量 tests、lint、typecheck、build、E2E 和 diff check 通过。
- 当前进展：远程目录客户端按文件名过滤 `merged_*.json`，排序合并并生成 SHA-256 checksum；启动脚本在 API 前应用迁移并执行现有 importer，失败时不覆盖已有 active dataset；测试 Compose 已默认指向用户 fork，生产可用环境变量关闭。
- 验收结果：EVD-M1-010-A；远程真实拉取 61 个文件/1677 条食物首次 `promoted`，checksum `76b5f360c3286e1a14c9e1c586335f3cae06ea9afed6acdce198998cda643ea2`，第二次 `already_promoted`；全量 183 files/1067 tests、lint/typecheck/build/API smoke/integration/E2E 2 passed/diff check 均 exit 0；docker smoke exit 0 但本机 Docker CLI 不可用。
- 下一步：进入 M3-004 MET/运动计算准备。

### M1-011 — 局域网 HTTP 下饮食记录幂等键兼容

- 状态：`DONE`
- 开始时间：2026-09-10 11:37 +08:00
- 操作者：Codex
- 依赖：M1-005、M1-007、API_SPEC.md 修改请求需幂等键约束
- 计划变更：修复局域网非 HTTPS 地址上 `crypto.randomUUID()` 不可用导致“加入记录”请求尚未发出即失败的问题；保留 HTTPS 下优先使用原生 UUID，非安全上下文使用本地幂等键回退。
- 计划验收：先观察 `randomUUID` 缺失回归测试 RED；再运行 focused Web tests、全量 `pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm test:e2e`、`git diff --check`。
- 完成时间：2026-09-10 11:50 +08:00
- 当前进展：新增 `createIdempotencyKey`；HTTPS/安全上下文优先使用原生 UUID，局域网 HTTP 缺失 `randomUUID` 时回退到带 `diary-` 前缀的本地幂等键，加入记录请求可正常发出。
- 验收结果：EVD-M1-011-A；先观察 `crypto.randomUUID is not a function` RED，再 GREEN；focused 1 file/6 tests、全量 183 files/1068 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0。
- 阻塞/风险：无；本机 Docker CLI 缺失，只能依赖 CI buildx 完成镜像验证。
- 下一步：提交并推送 `main`，通知飞牛强制 pull/recreate。

### M2-001 — Profile 与目标版本

- 状态：`DONE`
- 开始时间：2026-09-10 01:40 +08:00
- 完成时间：2026-09-10 01:55 +08:00
- 操作者：Codex
- 依赖：M0-006、M1-006；M1-007 的浏览器视觉证据不阻塞本任务的纯计算与 API 工作
- 计划变更：按 `NUTRITION_ENGINE_SPEC` 固定 Mifflin–St Jeor BMR、活动系数 TDEE、用户调整量/手动覆盖和宏量目标边界；保留有效期 goal 版本与已有 diary goal snapshot 语义。
- 计划验收：先写并观察 BMR/TDEE golden tests RED，再实现最小纯函数；补 profile service 的估算输入校验、手动目标优先级和历史有效期回归；运行聚焦测试及全量 lint/typecheck/test/build/API smoke/diff check。
- 当前进展：新增 `energy_estimate_v1`，实现 Mifflin–St Jeor BMR、活动系数 TDEE、固定/百分比调整和手动目标优先级；profile service 与 `POST /api/v1/profile/goals/estimate` 已接入，原有 goal effective range、macro target 和 diary goal_id snapshot 保持不变。
- 验收结果：EVD-M2-001-A；聚焦 nutrition-engine/profile/API 测试通过；全量 110 files/588 tests、lint、typecheck、build、API smoke、diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用。
- 阻塞/风险：年龄/体重采集属于 M2-002 体重模型的输入；本任务先让计算函数接受显式输入，不提前改写体重记录模型；BLK-007 继续只影响 M1-007 浏览器视觉验收。
- 下一步：进入 M2-002，补体重记录 schema/domain；M1-007 视觉阻塞单独保留。

### M2-002 — 体重记录

- 状态：`DONE`
- 开始时间：2026-09-10 02:05 +08:00
- 完成时间：2026-09-10 02:25 +08:00
- 操作者：Codex
- 依赖：M2-001、M0-004
- 计划变更：新增 `body_weight_entry` 前向迁移、体重记录 domain 与 REST 读写路径；保存测量时间、用户时区对应的 local date、来源和备注，允许同日多次测量并用乐观版本保护编辑/删除。
- 计划验收：先写 migration/domain/API RED 测试；验证正数体重、ISO 时间、同日多条、按时间查询、版本冲突、跨用户隔离和删除；全量 lint/typecheck/test/build/API smoke/diff check。
- 当前进展：新增 `0010_body_weight` 迁移和独立 `@nutrition-tracker/body` package；保存 UTC measuredAt、profile timezone 对应 localDate、source/note/version，支持同日多次记录、范围查询和版本保护的更新/删除；API 已接入鉴权路由。
- 验收结果：EVD-M2-002-A；聚焦 body/API 2 files/4 tests；全量 123 files/647 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用。
- 阻塞/风险：时区 local date 依赖 profile timezone；本任务暂不实现趋势/EWMA、BMI 展示或 UI，避免提前扩大到 M2-003/M2-006；BLK-007 继续只影响 M1-007 浏览器视觉验收。
- 下一步：进入 M2-003，固定趋势采样和 EWMA/rolling 计算 contract。

### M2-003 — 趋势引擎

- 状态：`DONE`
- 开始时间：2026-09-10 02:35 +08:00
- 完成时间：2026-09-10 02:55 +08:00
- 操作者：Codex
- 依赖：M2-002、NUTRITION_ENGINE_SPEC 第 18 节
- 计划变更：实现 7/14/30/90 天 rolling mean 与 EWMA；同日测量支持 last/average 采样；缺失日期不插值，固定 `weight_trend_v1` 和 alpha=0.25。
- 计划验收：先写纯函数 golden tests RED；验证无观测、缺失日期、同日多次、窗口边界、方法/alpha 校验和确定输出；运行全量 lint/typecheck/test/build/API smoke/diff check。
- 当前进展：`@nutrition-tracker/body` 新增 `sampleDailyWeights` 和 `calculateWeightTrend`；支持同日 last/average、7/14/30/90 日历窗口 rolling/EWMA、缺失日期不插值和 `weight_trend_v1`/alpha=0.25；REST `GET /api/v1/body/weight-trend` 已接入。
- 验收结果：EVD-M2-003-A；聚焦 body/API 2 files/7 tests；全量 123 files/653 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用。
- 阻塞/风险：趋势只消费已保存体重记录，不生成虚构观测；Adaptive TDEE 和 analytics read model 留给 M2-004/M2-005。
- 下一步：进入 M2-004，建立 analytics read model 并接入已有 daily summary 与体重趋势。

### M2-004 — Analytics read model

- 状态：`DONE`
- 开始时间：2026-09-10 03:05 +08:00
- 完成时间：2026-09-10 03:25 +08:00
- 操作者：Codex
- 依赖：M1-006、M2-002、M2-003
- 计划变更：从已有 `analytics_daily_summary` 和 body weight trend 只读构建 overview，提供平均摄入/宏量、目标差异、记录 coverage、体重首末值与变化；数据不足返回 null/0，不伪造估算。
- 计划验收：先写纯 read-model RED 测试；验证空区间、缺失 goal、覆盖率、目标差异、体重变化和范围日期校验；接入 `GET /api/v1/analytics/overview` 后运行全量门禁。
- 当前进展：新增独立 `@nutrition-tracker/analytics` read model，从 `analytics_daily_summary` 和 `body_weight_entry` 只读构建 period、record coverage、平均摄入/宏量、goal difference 和 weight delta；已接入 `GET /api/v1/analytics/overview`，不足数据显式返回 null/0。
- 验收结果：EVD-M2-004-A；聚焦 analytics/API 2 files/4 tests；全量 138 files/724 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用。
- 阻塞/风险：Adaptive TDEE、21/28 天门槛和 UI 留给 M2-005/M2-006；overview 不会自动改写 calorie target。
- 下一步：进入 M2-005，固定 Adaptive TDEE 的门槛、confidence 和节流策略。

### M2-005 — Adaptive TDEE v1

- 状态：`DONE`
- 开始时间：2026-09-10 03:35 +08:00
- 完成时间：2026-09-10 03:55 +08:00
- 操作者：Codex
- 依赖：M2-003、M2-004、NUTRITION_ENGINE_SPEC 第 19–20 节
- 计划变更：实现 21 天最低窗口、推荐 28 天窗口、至少 8 次体重观测、diary coverage/confidence、7 天更新节流和旧估算平滑；只返回估算，不自动修改 calorie target。
- 计划验收：先写纯函数 RED/golden tests；验证数据不足返回 null、固定模拟数据确定输出、节流/平滑、confidence 边界和负/正体重变化公式。
- 当前进展：`@nutrition-tracker/analytics` 新增 `estimateAdaptiveTdee` 与 `GET /api/v1/analytics/tdee`；固定 `adaptive_tdee_v1`、21 天最低窗口、至少 8 次观测、coverage 0.7、confidence、7 天节流和 0.7/0.3 平滑；不足数据返回 null，推荐目标始终 null。
- 验收结果：EVD-M2-005-A；聚焦 analytics/API 2 files/7 tests；全量 138 files/730 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用。
- 阻塞/风险：本任务不实现 scheduler/job lock 持久化或 UI；推荐目标写回留给用户确认和后续 M2-006。
- 下一步：进入 M2-006，接入目标、体重、趋势和分析页面，并补前端状态/E2E。

### M2-006 — UI/E2E：目标、体重、趋势和分析

- 状态：`DONE`
- 开始时间：2026-09-10 03:55 +08:00
- 恢复时间：2026-09-10 04:20 +08:00
- 完成时间：2026-09-10 06:30 +08:00
- 操作者：Codex
- 依赖：M1-007、M2-001 至 M2-005
- 计划变更：将体重记录/趋势、Analytics overview、Adaptive TDEE 接入现有 Dashboard 导航；补加载、空数据、错误、数据不足状态和体重新增表单。
- 计划验收：Web 聚焦测试、全量 lint/typecheck/test/build/API smoke/diff check；真实浏览器验证页面切换、表单写入、API 错误状态和 360/390/430 无横向溢出。
- 当前进展：前端 API client、WeightPanel、AnalyticsPanel 和五项导航数据接入完成；搜索/日记响应契约已对齐；空、错误、不足状态与 44px 导航命中区有测试；Playwright 覆盖首次设置、登录、搜索成功/空状态、记账、体重写入、分析不足和三档 viewport 截图。
- 活动日志：2026-09-10 04:20 +08:00 恢复实施；2026-09-10 06:30 +08:00 完成验收，操作者 Codex。
- 验收结果：EVD-M2-006-B；`pnpm lint`、`pnpm typecheck`、`pnpm test`（138 files/732 tests）、`pnpm test:integration`、`pnpm build`、`pnpm api:smoke`、`pnpm test:e2e`（1 passed，360/390/430 截图和无横向溢出）、`git diff --check` 均 exit 0；30 天 EWMA 性能 p50 0.061ms、p95 0.135ms、max 11.989ms。
- 阻塞/风险：无；本机 Docker CLI 缺失继续只影响容器实测。
- 下一步：进入 M3-001，先确认菜谱 ingredient snapshot 与 food projection 边界。

### M3-001 — 菜谱数据决策

- 状态：`DONE`
- 开始时间：2026-09-10 07:20 +08:00
- 操作者：Codex
- 依赖：M1-005、M1-004、NUTRITION_ENGINE_SPEC 第 9–10 节
- 计划变更：落实 ingredient nutrition snapshot、recipe cache 失效、food projection 单向关系和 recipe-to-diary 历史边界。
- 当前进展：已形成并写入 `ADR-0002-recipe-snapshot.md`；同步 `DATABASE_SCHEMA.md` 的 ingredient nutrient snapshot/cache 语义和 `API_SPEC.md` 的显式 refresh/warning contract；DEC-006 已为 `ACCEPTED`。
- 活动日志：2026-09-10 07:20 +08:00，操作者 Codex；完成 ADR 自洽检查、规范互链/术语检查和文档 diff 验证。
- 验收结果：EVD-M3-001-A、EVD-M3-001-B；5 个文档存在且非空，snapshot/cache/food projection/refresh/warning/recipe-to-diary/`recipe_yield_v1` 术语检查通过，`git diff --check` exit 0。
- 阻塞/风险：无；用户已确认继续后续开发，ADR contract 进入实现阶段。
- 下一步：进入 M3-002 的 TDD schema/domain/API 实现。

### M3-002 — 菜谱计算与 API

- 状态：`DONE`
- 开始时间：2026-09-09 22:39 +08:00
- 完成时间：2026-09-10 04:50 +08:00
- 操作者：Codex
- 依赖：M3-001、M1-001、M1-004、M1-005、`ADR-0002-recipe-snapshot.md`
- 计划变更：按 `docs/superpowers/plans/2026-09-09-recipe-calculation-api.md` 增加 recipe migration、纯计算器、ingredient snapshot/cache 服务、copy/edit/delete/refresh、recipe-to-diary snapshot writer、鉴权 API 和 typed web client。
- 当前进展：Task 1–5 已完成：迁移/纯计算器/快照持久化/cache/刷新/复制/版本与软删除、recipe-to-diary snapshot writer、认证 API 和 typed web client 已落地；Task 6 文档同步与完整验收已完成。另修复 Web 按 UTC 日期查询导致用户时区跨日后记录列表缺失的问题，并补充日期依赖闭包回归。
- 活动日志：2026-09-09 22:39 +08:00 开始 M3-002；2026-09-10 04:21 +08:00 完成 Task 1；2026-09-10 04:24 +08:00 完成 Task 2；2026-09-10 04:32 +08:00 完成 Task 3；2026-09-10 04:36 +08:00 完成 Task 4；2026-09-10 04:40 +08:00 完成 Task 5；2026-09-10 04:45 +08:00 E2E 首次失败并完成根因定位；2026-09-10 04:48 +08:00 时区日期与闭包修复后 E2E 通过；2026-09-10 04:50 +08:00 完成完整门禁，操作者 Codex。
- 验收结果：EVD-M3-002-A 至 EVD-M3-002-F；完整 lint/typecheck/test/integration/build/API smoke/E2E/diff gate 通过。
- 阻塞/风险：本机 Docker CLI 缺失，仅影响本地容器实测，不影响非 Docker 验收和 CI buildx；若遇到新的实现阻塞，必须立即改为 `BLOCKED` 并记录解除条件。
- 下一步：进入 M3-003 菜谱 UI/E2E。

### M3-003 — 菜谱 UI/E2E

- 状态：`DONE`
- 开始时间：2026-09-10 05:48 +08:00
- 完成时间：2026-09-10 08:08 +08:00
- 操作者：Codex
- 依赖：M3-002、M1-004、M1-005、M1-007
- 计划变更：在现有 React/Vite Dashboard 中提供菜谱列表、创建/编辑、原料搜索、营养结果、warnings、显式刷新、复制/删除和加入日记闭环；不新增数据库迁移，复用已完成 Recipe API 与 diary snapshot 边界。
- 计划验收：先完成设计规格与实施计划；再按 TDD 补 Web 交互测试和 Playwright E2E，覆盖创建→计算→warnings→刷新/复制/删除→加入日记→历史快照不漂移；运行全量 lint/typecheck/test/integration/build/API smoke/E2E/diff gate。
- 当前进展：设计规格、实施计划、首轮 Task 1–5 和独立终审修复 Task 7–18 已完成；HTTP NAS 兼容、快照编辑边界、详情刷新、空搜索反馈、并发状态隔离、错误引导和 E2E 证据缺口均已修复并完成 scoped review。
- 活动日志：2026-09-10 05:48 +08:00 开始 M3-003；06:14–07:01 完成首轮 Task 1–6；07:16 开始终审修复；07:45–08:00 完成独立修复与复核；08:01 开始最终门禁；08:08 完成最终门禁和交接文档，操作者 Codex。
- 修复提交：`85aa305`、`65e1029`、`450cc46`、`1bd4267`、`0514e52`、`8cf3d48`、`1916a57`、`26ab2d0`、`96d7367`、`fe5228f`、`09583eb`、`9738704`。
- 验收命令：`pnpm lint`（exit 0）；`pnpm typecheck`（exit 0）；`pnpm test`（exit 0，176 files/1031 tests passed）；`pnpm test:integration`（exit 0，无匹配测试文件）；`pnpm build`（exit 0）；`pnpm api:smoke`（exit 0，home/health/ready 均 200）；`pnpm test:e2e`（exit 0，Playwright 1 passed，7.1s）；`git -c safe.directory='D:/AI编程/体重管理' diff --check`（exit 0）。
- 验收结果：E2E 覆盖菜谱创建、食物搜索与选择、total/per100g/perServing、成品重量 warning、复制/编辑/显式刷新/删除、加入日记后的 snapshot 不漂移，以及 360/390/430px 无横向溢出和 44px 命中区。
- 阻塞/风险：本机 Docker CLI 缺失，未执行本地容器构建/启动验证；该限制不影响非 Docker 门禁，CI buildx 发布证据沿用 M0-007。无当前实现阻塞。
- 下一步：进入 M3-004 MET/运动计算，先读取运动产品/技术规范并定义运动记录、MET 计算和历史 snapshot 边界。

### M3-008 — 饮食分餐快捷添加

- 状态：`DONE`
- 开始时间：2026-09-10 19:55 +08:00
- 完成时间：2026-09-10 20:10 +08:00
- 操作者：Codex
- 依赖：M3-007、UI_DESIGN_SYSTEM.md §7.2
- 计划变更：为早餐、午餐、晚餐、加餐增加快捷添加入口；点击后复用统一搜索/份量确认流程并预选目标餐次，不改变 API、数据库、营养计算或快照边界。
- 计划验收：四餐入口可见且键盘可达；目标餐次预选；搜索/选择/份量/保存路径保持；移动端无横向溢出且控件命中区不小于 44px；focused tests、lint、typecheck、build、E2E 和 diff check 通过。
- 当前进展：先观察四餐入口契约缺失的 RED，再实现四个餐次摘要的快捷添加按钮；点击后预选目标餐次、清空旧选择、聚焦统一搜索框，并保留原有份量确认、保存、编辑、删除、复制和 API/快照边界。移动端补齐按钮堆叠与 44px 命中区。
- 验收结果：EVD-M3-008-A；聚焦 2 files/11 tests、全量 182 files/1063 tests、lint/typecheck/build/diff check、Playwright 2 tests 均 exit 0；四餐按钮、目标餐次上下文、搜索框焦点、360/390/430/1024/1440 视口无回归。
- 下一步：进入 M3-004 MET/运动计算准备。

### M3-009 — 今日热量摘要

- 状态：`DONE`
- 开始时间：2026-09-10 22:40 +08:00
- 操作者：Codex
- 依赖：M1-006 Dashboard read model、M3-007 Data Garden UI、UI_DESIGN_SYSTEM.md §7.1
- 计划变更：完善今日页首屏热量卡；无饮食记录时明确显示已摄入 `0 kcal` 和完整剩余预算；有记录时显示已摄入/目标/剩余；超预算时剩余不显示负数并解释超出量；无目标时保持“暂不可用”事实边界。
- 计划验收：先观察空日与超预算测试 RED；再运行 TodayPage focused tests、全量 `pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm api:smoke`、`pnpm test:e2e`、`git diff --check`。
- 完成时间：2026-09-10 22:50 +08:00
- 当前进展：今日热量卡已显示标题、还可以吃、已摄入/目标；无记录时使用真实的 `0 kcal` 和完整剩余预算；超预算时将剩余钳制为 `0 kcal` 并显示超出量；无目标仍明确显示暂不可用。
- 验收结果：EVD-M3-009-A；先观察空日/超预算 RED，再 GREEN；focused TodayPage 6 tests、全量 183 files/1070 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0。
- 阻塞/风险：无；不新增 API、数据库或营养计算逻辑。
- 下一步：推送 `main`。

### M3-010 — 今日页体重趋势摘要

- 状态：`DONE`
- 开始时间：2026-09-10 23:05 +08:00
- 完成时间：2026-09-10 23:20 +08:00
- 操作者：Codex
- 依赖：M2-002、M2-003、M3-007、UI_DESIGN_SYSTEM.md §7.1
- 计划变更：在今日页常态化展示最近一周体重趋势；查询范围为今天往前 7 天至今天；仅当范围内存在真实记录时渲染卡片，否则完全隐藏；复用服务端趋势值，不新增 API 或数据库迁移。
- 变更文件：`apps/web/src/App.tsx`、`apps/web/src/ui/TodayPage.tsx`、`apps/web/src/ui/WeightPage.tsx`、`apps/web/src/ui/WeightTrendChart.tsx`、`apps/web/src/styles.css`、`apps/web/test/today-page.test.tsx`、`UI_DESIGN_SYSTEM.md`
- 计划验收：先观察 TodayPage 无记录/单点/多点测试 RED；再运行 focused Web tests、全量 `pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm api:smoke`、`pnpm test:e2e`、`git diff --check`。
- 验收结果：EVD-M3-010-A；先观察趋势卡契约缺失 RED，再 GREEN；focused Today/Weight 14 tests、全量 183 files/1073 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0。
- 阻塞/风险：无；今日页趋势请求失败不得阻塞热量和饮食主流程。
- 下一步：进入 M3-004 MET/运动计算准备。

### M3-011 — 今日饮食记录功能区

- 状态：`DONE`
- 开始时间：2026-09-10 23:25 +08:00
- 完成时间：2026-09-10 23:45 +08:00
- 操作者：Codex
- 依赖：M1-005、M1-006、M3-007、M3-008、UI_DESIGN_SYSTEM.md §7.1/§7.2
- 计划变更：将今日页餐次摘要重构为可操作的饮食记录卡；增加四餐独立添加入口、记录饮食总入口、无记录空状态、目标餐次联动和搜索面板聚焦；复用现有本地食物搜索、日记写入、营养快照和 dashboard 刷新链路，不新增 API 或数据库迁移。
- 变更文件：`apps/web/src/ui/TodayPage.tsx`、`apps/web/src/App.tsx`、`apps/web/src/styles.css`、`apps/web/test/today-page.test.tsx`、`apps/web/test/dashboard-view.test.ts`、`e2e/dashboard.spec.ts`、`UI_DESIGN_SYSTEM.md`
- 计划验收：先观察 TodayPage 四餐入口/空状态 RED；再运行 focused Web tests、全量 `pnpm test`、`pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm api:smoke`、`pnpm test:e2e`、`git diff --check`。
- 验收结果：EVD-M3-011-A；先观察四餐入口/空状态契约 RED，再 GREEN；focused 2 files/17 tests、全量 183 files/1076 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0；期间修复新增按钮与导航按钮的无障碍名称冲突。
- 阻塞/风险：无；保存失败必须保留搜索和份量输入，未知营养不能伪装成 0。
- 下一步：进入 M3-004 MET/运动计算准备。

### M3-007 — Data Garden 全站 UI 重构

- 状态：`DONE`
- 开始时间：2026-09-10 08:52 +08:00
- 完成时间：2026-09-10 19:45 +08:00
- 操作者：Codex + 独立逐任务实现/复审
- 依赖：DOC-005、M1-007、M2-006、M3-003
- 计划变更：依据 `UI_DESIGN_SYSTEM.md` v2.0，按独立任务完成共用 AppShell/tokens、今日、饮食、菜谱、体重、分析、我的/auth/setup 和跨页 QA；不改变 API、数据库、营养计算或快照边界。
- 当前进展：Task 1–8 均完成独立实现与 scoped review；Task 8 补齐跨页 UI 回归、旧 diary E2E 文本契约和体重/分析可访问语义，覆盖 1440/1024/430/390/360 视口。
- 变更文件：`apps/web/src/ui/*`、`apps/web/src/App.tsx`、`apps/web/src/styles.css`、`apps/web/test/*`、`e2e/dashboard.spec.ts` 相关语义兼容、`e2e/ui-regression.spec.ts`。
- 验收结果：详见 `docs/superpowers/sdd/2026-09-10-data-garden-ui-refactor/task-8-report.md`；lint/typecheck/test/integration/build/API smoke/diff gate 已通过；`pnpm test:e2e` 在 `workers: 1` 下 exit 0，2 tests passed，覆盖六导航与五档视口。
- 阻塞/风险：本机 Docker CLI 不可用，未执行本地容器 build/run；不影响前端和 API 非容器门禁，后续应由 CI buildx 或 NAS 完成容器实测。跨页 Playwright 在本地可运行并通过 2 tests。
- 下一步：进入 M3-004 MET/运动计算，先读取运动产品/技术规范并定义运动记录、MET 计算和历史 snapshot 边界。

## 4. DOC 任务板

| ID | 任务 | 状态 | 负责人 | 证据/备注 |
|---|---|---|---|---|
| DOC-001 | 通读并交叉审查原有 8 份开发文档 | `DONE` | Codex | 审查范围及结论见 `PLAN_REVIEW.md` |
| DOC-002 | 建立 README、审查报告、路线图、进度记录和 AGENTS 规则 | `DONE` | Codex | EVD-DOC-002 |
| DOC-003 | 确认 P0 决策并同步修订原始规范（后续，不计入本次 DOC 基线） | `PLANNED` | 未分配 | 应在开始业务代码前处理 GAP-002/003/007/008/009 |
| DOC-004 | 建立 GitHub Docker 内容发布计划与敏感内容隔离规则 | `DONE` | Codex | EVD-DOC-004；已同步 README 与 DOCKER_DEPLOYMENT；当前未执行远程上传 |
| DOC-005 | 按第三套方案重写统一 UI 设计规范手册 | `DONE` | Codex | `UI_DESIGN_SYSTEM.md` v2.0；覆盖桌面/移动端、六页、组件状态、交互一致性、无障碍和视觉验收；EVD-DOC-005 |
| M3-007 | Data Garden 全站 UI 重构 | `DONE` | Codex | Task 1–8 代码与独立复审完成；全量 E2E 在 workers=1 下 2 tests passed，证据见 `task-8-report.md` |
| M3-008 | 饮食分餐快捷添加 | `DONE` | Codex | 四餐快捷入口、目标餐次预选、搜索框聚焦与响应式 44px 命中区已完成；见 EVD-M3-008-A |
| M3-009 | 今日热量摘要 | `DONE` | Codex | 空日显示 0 摄入与剩余预算，超预算钳制显示并解释超出量，无目标保持暂不可用；见 EVD-M3-009-A |
| M3-010 | 今日页体重趋势摘要 | `DONE` | Codex | 最近 7 天真实记录趋势卡；无近期记录隐藏；共享趋势图与移动端样式；见 EVD-M3-010-A |
| M3-011 | 今日饮食记录功能区 | `DONE` | Codex | 四餐添加入口、记录饮食总入口、空状态、目标餐次联动和搜索聚焦；见 EVD-M3-011-A |
| M1-010 | 测试期远程食物目录导入 | `DONE` | Codex | 61 个 JSON/1677 条食物真实拉取并导入；重复启动幂等；见 EVD-M1-010-A |

## 5. M0 待办队列

| ID | 任务 | 状态 | 依赖 | 首要验收 |
|---|---|---|---|---|
| M0-001 | 版本控制与工作区基线 | `DONE` | 文档基线 | EVD-M0-001-B |
| M0-002 | SQLite/ORM 技术门 | `DONE` | M0-001 | EVD-M0-002-A/B/C；候选通过本地门禁及远程多架构 buildx |
| M0-003 | Core contracts | `DONE` | M0-001 | EVD-M0-003-A |
| M0-004 | Schema 与 migration 基线 | `DONE` | M0-002/003 | EVD-M0-004-A |
| M0-005 | Backup/restore 最小闭环 | `DONE` | M0-004 | EVD-M0-005-A |
| M0-006 | 首次初始化与鉴权 | `DONE` | M0-003/004 | EVD-M0-006-A |
| M0-007 | 可执行容器与 CI | `DONE` | M0-004/005/006 | EVD-M0-007-D |

M1–M5 的完整任务和退出门槛见 `IMPLEMENTATION_ROADMAP.md`。只有当前里程碑进入实施时，才把其任务复制到本页活动任务板，避免顶部状态被远期细节淹没。

## 6. 阻塞项

当前有一个环境阻塞。以下决策会阻塞对应任务，但不阻止已可独立验证的本地工作：

| Blocker | 影响任务 | 解除条件 | 状态 |
|---|---|---|---|
| BLK-001 SQLite 驱动未锁定 | M0-004 及后续 DB 工作 | 已完成 M0-002 技术门并接受 ADR | `RESOLVED` |
| BLK-002 Auth session 方案未确定 | M0-004/M0-006 | 已接受有状态 DB session，并由 `core_session` 落库 | `RESOLVED` |
| BLK-003 Recipe snapshot 语义未落库 | M3-001 | 接受 ingredient 计算输入快照设计并修订 schema | `OPEN` |
| BLK-004 工作区隔离方式待确认 | M0-001 后半段及后续实现 | 已创建 `.worktrees/m0-foundation` 和 `feat/m0-foundation` | `RESOLVED` |
| BLK-005 Docker CLI 未安装 | M0-002 完整技术门、M0-007 | 已由 GitHub Actions buildx 完成 linux/amd64、linux/arm64 构建；本机 CLI 仍可后续安装 | `RESOLVED` |
| BLK-006 远程 verify 的重复 Docker smoke 失败 | main 合并后的 GHCR 发布 | 已将 `pnpm docker:smoke` 从 verify 移出，由 `docker` job 直接执行 build-push；后续 run `34342506965` 成功并更新 GHCR `latest` | `RESOLVED` |
| BLK-007 IAB 本地 API/viewport 能力受限 | M1-007 动态搜索与 390/430 视觉验收 | 浏览器客户端访问本地 `/api/v1/foods/search` 被 `ERR_BLOCKED_BY_CLIENT` 拦截；viewport override 在 IAB 不生效；已由本地 Chromium Playwright + CI job 覆盖，保留 IAB 限制作为环境备注 | `RESOLVED` |

## 7. 决策记录

| 决策 ID | 状态 | 决策 | 理由 | 日期 |
|---|---|---|---|---|
| DEC-001 | `ACCEPTED` | 保留模块化单体、单业务容器和 SQLite | 与个人自托管规模匹配，运维成本最低 | 2026-09-09 |
| DEC-002 | `ACCEPTED` | 迁移、最小备份恢复和鉴权前移到 M0 | 它们是安全迭代的基础，不应等到稳定化阶段 | 2026-09-09 |
| DEC-003 | `ACCEPTED` | V1 offline 定义为“不依赖公网”，不支持客户端脱离服务器写入 | 避免首版引入同步与冲突合并复杂度 | 2026-09-09 |
| DEC-004 | `ACCEPTED` | V1 锁定 `node:sqlite + Drizzle` | 本地 migration/WAL/FTS5/backup/transaction 门禁通过，GitHub Actions 多架构 Docker buildx 通过；RC 风险保留在 ADR 的升级检查中 | 2026-09-09 |
| DEC-005 | `PROPOSED` | V1 暂不实现围度管理 | 产品验收未要求，避免无 UI/API 的幽灵功能 | 2026-09-09 |
| DEC-006 | `ACCEPTED` | 菜谱保存 ingredient 计算输入快照，编辑或显式刷新时重建；food 只作为单向来源投影，cache 失效后懒重算，加入日记时再次写 diary snapshot | 保持来源可追溯，同时让菜谱和日记历史永不漂移；详见 `ADR-0002-recipe-snapshot.md` | 2026-09-10 |
| DEC-007 | `ACCEPTED` | V1 使用有状态数据库 session；token 只以 SHA-256 保存，cookie 默认 HttpOnly/SameSite=Lax | 支持撤销、过期和重启后的明确会话状态；避免无状态 token 无法即时失效 | 2026-09-09 |
| DEC-008 | `ACCEPTED` | canonical nutrient unit 增加 `kJ`，`energy_kj` 必须以 `kJ` 持久化 | `FOOD_DATA_SPEC.md` 与 `DATABASE_SCHEMA.md` 已定义 energyKJ/energy_kj，但原 schema 的单位 CHECK 漏列 kJ；错误标为 kcal 会污染导入数据 | 2026-09-09 |
| DEC-009 | `ACCEPTED` | M1-007 扩展为登录 + 首次设置完整流程；HTTP 层使用 M0-006 有状态数据库 session，首次设置一次性创建用户并随后建立会话；业务 API 从 session 取得 userId，不再固定 `local-user` | 用户确认完整登录/首次设置范围；保持现有安全边界，避免前端绕过鉴权或出现多用户数据串读 | 2026-09-09 |

`PROPOSED` 决策不能作为最终 contract。进入受影响任务前，必须改为 `ACCEPTED`、`REJECTED` 或 `SUPERSEDED`，并同步相关规范。

## 8. 验收证据

| Evidence ID | 任务 | 时间 | 命令/检查 | 结果 |
|---|---|---|---|---|
| EVD-DOC-001 | DOC-001 | 2026-09-09 06:30 +08:00 | 原始文档清单、标题和交叉需求检查 | 8/8 已审查；缺口登记于 `PLAN_REVIEW.md` |
| EVD-DOC-002 | DOC-002 | 2026-09-09 06:38 +08:00 | PowerShell：文件存在/非空、README 本地链接、H1、原始文档存在、路线任务数 | exit 0；新增 5/5，原始 8/8，链接全部解析，M0–M5 任务数 7/8/6/6/6/8 |
| EVD-DOC-004-A | DOC-004 | 2026-09-09 07:11 +08:00 | PowerShell 文档断言检查：仓库 URL、暂不上传声明、`plan/` 与 `/data` 排除项、人工确认闸门 | exit 0；8/8 项检查通过 |
| EVD-DOC-004-B | DOC-004 | 2026-09-09 07:11 +08:00 | `git diff --check`、`git status --short`、`git remote -v` | diff check exit 0；3 个规范文件按预期修改；未输出 remote，未执行远程上传 |
| EVD-M0-001-A | M0-001 | 2026-09-09 06:45 +08:00 | `git init -b main`、暂存检查、基线提交、`git status --short` | 仓库已创建；提交 `6ae1c95`；提交后工作区为空 |
| EVD-M0-001-B | M0-001 | 2026-09-09 06:53 +08:00 | `pnpm install`、`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:integration`、`pnpm build`、`pnpm docker:smoke` | 全部 exit 0；1 个 workspace 单元测试通过；集成测试暂时无用例但允许空；workspace smoke 通过 |
| EVD-M0-002-A | M0-002 | 2026-09-09 07:02 +08:00 | `pnpm test -- --run packages/db/test/sqlite-driver.test.ts` | 2 test files、6 tests passed；覆盖 PRAGMA、rollback、FTS5、Drizzle、backup |
| EVD-M0-002-B | M0-002 | 2026-09-09 07:02 +08:00 | `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:integration`、`pnpm build`、`pnpm docker:smoke` | 全部 exit 0；M0-002 候选实现可编译并通过全量门禁；multi-arch 仍待补 |
| EVD-M0-002-C | M0-002 | 2026-09-09 07:05 +08:00 | `docker --version`、`docker buildx version` | exit 1；Docker CLI 在当前环境不存在，不能声称多架构验证通过 |
| EVD-M0-003-A | M0-003 | 2026-09-09 07:08 +08:00 | `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:integration`、`pnpm build`、`pnpm docker:smoke` | 全部 exit 0；3 test files、14 tests passed；core contracts 已编译 |
| EVD-M0-004-A | M0-004 | 2026-09-09 07:20 +08:00 | `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:integration`、`pnpm build`、`pnpm docker:smoke` | 全部 exit 0；4 test files、16 tests passed；core/profile/session/idempotency/job schema 与约束已验证 |
| EVD-M0-005-A | M0-005 | 2026-09-09 07:27 +08:00 | `pnpm lint`、`pnpm typecheck`、`pnpm build`、`pnpm test`、`pnpm test:integration`、`pnpm docker:smoke` | 全部 exit 0；5 test files、18 tests passed；backup manifest、checksum、integrity_check 与损坏恢复保护已验证 |
| EVD-M0-006-A | M0-006 | 2026-09-09 07:35 +08:00 | `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:integration`、`pnpm build`、`pnpm docker:smoke` | 全部 exit 0；6 test files、22 tests passed；bootstrap once、scrypt hash、credential errors、session expiry/revocation、cookie defaults 已验证 |
| EVD-M0-007-A | M0-007 | 2026-09-09 07:45 +08:00 | `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:integration`、`pnpm build`、`pnpm docker:smoke`；构建后 API smoke | 代码门禁 exit 0；6 test files、22 tests passed；API `/healthz` 与 `/readyz` 均 200；`docker:smoke` 明确报告 Docker CLI 缺失，任务保持 BLOCKED |
| EVD-M0-007-B | M0-007 | 2026-09-09 07:50 +08:00 | `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm api:smoke`、`pnpm docker:smoke` | 全部 exit 0；API smoke 脚本纳入可重复门禁并返回 health=200、ready=200；Docker smoke 仍因 CLI 缺失保持 BLOCKED |
| EVD-M0-007-C | M0-007 | 2026-09-09 08:00 +08:00 | GitHub Actions run `34291079576`；本地 `pnpm install --frozen-lockfile`（强制重链）及完整 lint/typecheck/test/build/api smoke | 首次远程 verify 在 install 阶段失败；根因是 `allowBuilds` 占位值；修正为 `esbuild: true` 后本地干净安装 exit 0，完整门禁重新通过，等待远程重跑 |
| EVD-M0-007-D | M0-007 | 2026-09-09 08:20 +08:00 | GitHub Actions run `34291487487`：verify + `docker/build-push-action@v6`，platforms `linux/amd64,linux/arm64` | verify `success`；Docker buildx `success`；M0-002/M0-007 阻塞解除，M0 关闭 |
| EVD-M0-007-E | M0-007 | 2026-09-09 08:40 +08:00 | GitHub Actions run `34292835823`；GHCR package 页面与 manifest | 实际 push 成功；`latest` 和 `206adb469a8a34f640705de06abea255f50dca12` 标签可用，包含 linux/amd64、linux/arm64；manifest digest `sha256:28045d2384efeabac7cc02da393d2af3c079421e19c671f08f54655a4564bc85` |
| EVD-M0-007-F | M0-007 | 2026-09-09 09:12 +08:00 | 飞牛启动失败复盘；检查 `Dockerfile` runtime COPY、workspace symlink 与 Compose bind mount 运行用户；本地 `pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm build`、`pnpm api:smoke`、`pnpm docker:smoke` | 发现 runtime 未复制 `apps/api/node_modules`，API workspace 依赖可能在容器内缺失；已补 COPY；Compose 改为 root 启动时 `chown -R 10001:10001 /data` 后以 `appuser` 执行 API；代码门禁全部 exit 0，Docker CLI 仍缺失，等待远程 buildx |
| EVD-M0-007-G | M0-007 | 2026-09-09 09:18 +08:00 | GitHub Actions run `34293880647`（main）与 `34293870807`（feature）；GHCR package manifest | 两个远程 workflow 均 `success`；新镜像 `latest`/`401da835f69de08af041eb39e941703fbf3e81bb` 已发布，manifest digest `sha256:34dcad2ffa1d6d3e4bc305a2b5997478caaef4087f3024dc9e7a4a1d9b7bbbc`，linux/amd64 digest `sha256:483e2bb9dbf9676566bdc94595b52ed3237649f6e0006d9dd772eb24cdd488bc`，linux/arm64 digest `sha256:7f4c28b2c2682d114f5aede87ae1ebf6fc25e2588f2ea69ca8b5fe4ba36229ec` |
| EVD-M0-007-H | M0-007 | 2026-09-09 09:28 +08:00 | 飞牛日志：`Restarting (1)`、`chown: missing operand`；复核 Compose `entrypoint`/`command` 参数传递 | 确认上一版 Compose 在飞牛解析后把 shell 脚本拆成多个参数；已改为三段式 `entrypoint`，保证完整脚本作为 `/bin/sh -c` 单个参数执行；提交 `3d41734` 已推送，等待用户重建 |
| EVD-M0-007-I | M0-007 | 2026-09-09 09:46 +08:00 | 飞牛截图访问 `/` 返回 `{"error":"NOT_FOUND"}`；先运行 `pnpm api:smoke` 得到 `API_SMOKE_FAILED:404/200/200`，实现根路径状态页后重新运行 | 根路径现在返回 200 HTML 状态页，`/healthz` 与 `/readyz` 仍为 200；lint、build、22 tests 全部通过；等待远程镜像构建 |
| EVD-M0-007-J | M0-007 | 2026-09-09 09:55 +08:00 | GitHub Actions run `34296265518`（main）；GHCR package manifest | verify 与 multi-arch docker 均 `success`；镜像 `latest`/`cc60f7c62750202ef36d8601b67ee1e6b41dfaec` 已发布，manifest digest `sha256:4de30a0d390e1ce2a5f80399d6bed56f746fcdf7db0096bbe36be8b7e15f3557` |
| EVD-M1-001-A | M1-001 | 2026-09-09 10:00 +08:00 | `pnpm exec vitest run packages/nutrition-engine/test/nutrition-engine.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke` | 全部命令 exit 0；聚焦 1 file/6 tests、全量 7 files/28 tests；API smoke home/health/ready 均 200；Docker CLI 不存在但 smoke 正确报告环境阻塞 |
| EVD-M1-001-B | M1-001 | 2026-09-09 10:15 +08:00 | `pnpm exec vitest run packages/nutrition-engine/test/nutrition-engine.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm build` | coverage=0.5 的新断言先失败（received 0.625），最小修复后聚焦 1 file/6 tests、全量 7 files/28 tests 通过；所有列出命令 exit 0 |
| EVD-M1-003-A | M1-003 | 2026-09-09 18:37 +08:00 | importer focused/full verification before final identity fix | 4 项独立复审 Important 已修复；聚焦 2 files/15 tests、全量 13 files/63 tests，lint/typecheck/integration/build/API smoke exit 0；Docker CLI 缺失由 smoke 如实记录 |
| EVD-M1-003-B | M1-003 | 2026-09-09 20:30 +08:00 | `pnpm exec vitest run tools/food-import/test/food-import.test.ts packages/db/test/food-schema.test.ts`; full `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke` | 最终 identity 回归后聚焦 2 files/16 tests、全量 13 files/64 tests；所有命令 exit 0；API home/health/ready=200；Docker CLI 缺失已记录 |
| EVD-M1-004-A | M1-004 | 2026-09-09 20:42 +08:00 | 初版 focused/full gates | 聚焦 2 files/4 tests、全量 28 files/131 tests；API smoke 200；审查后发现 custom 原子性、快照、FTS/keyset、错误 envelope 等问题 |
| EVD-M1-004-E | M1-004 | 2026-09-09 21:10 +08:00 | 最终 `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`；focused DB/domain/route | 三轮审查修复后聚焦 3 files/15 tests、全量 28 files/137 tests；所有命令 exit 0；API home/health/ready=200；Docker CLI 缺失已记录；未声称 1,677/100k 性能目标 |
| EVD-M1-003-A | M1-003 | 2026-09-09 18:28 +08:00 | `pnpm vitest run tools/food-import/test/food-import.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke` | 聚焦 1 file/5 tests、全量 13 files/59 tests，lint/typecheck/build/API smoke 均 exit 0；docker smoke 正确报告 Docker CLI 缺失；实现待独立复审 |
| EVD-M1-003-B | M1-003 | 2026-09-09 18:37 +08:00 | `pnpm vitest run tools/food-import/test/food-import.test.ts`; `pnpm vitest run packages/db/test/food-schema.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke` | 审查修复聚焦 7 importer tests、8 schema tests；全量 13 files/63 tests；lint/typecheck/build/API smoke 均 exit 0；docker smoke 正确报告 Docker CLI 缺失；等待复审确认 |
| EVD-M1-004-A | M1-004 | 2026-09-09 20:42 +08:00 | `pnpm vitest run packages/food/test/food-api.test.ts apps/api/test/food-routes.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke` | 聚焦 2 files/4 tests、全量 28 files/131 tests，lint/typecheck/integration/build/API smoke 均 exit 0；Docker CLI 缺失由 smoke 如实记录；实现等待独立复审，未测量 1,677/100k p50/p95 |
| EVD-M1-004-B | M1-004 | 2026-09-09 20:52 +08:00 | `pnpm build`; focused 2 files/6 tests; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke` | 复审 6 项 Important 修复后全量 28 files/135 tests；lint/typecheck/build/API smoke exit 0；Docker CLI 缺失如实记录；等待复审确认 |
| EVD-M1-004-C | M1-004 | 2026-09-09 21:02 +08:00 | `pnpm lint`; `pnpm typecheck`; `pnpm build`; focused 2 files/7 tests; `pnpm test`; `pnpm test:integration`; `pnpm api:smoke`; `pnpm docker:smoke` | search_key migration/index、PATCH runtime validation、optional nutrient upsert 回归后全量 28 files/137 tests；所有本地门禁 exit 0，Docker CLI 缺失如实记录 |
| EVD-M1-004-D | M1-004 | 2026-09-09 21:06 +08:00 | `pnpm lint`; `pnpm typecheck`; `pnpm build`; focused DB/domain/route 3 files/15 tests; `pnpm test`; `pnpm test:integration`; `pnpm api:smoke`; `pnpm docker:smoke` | `0006` NOCASE prefix index 的 EXPLAIN 回归、empty nutrients PATCH 400 envelope 均通过；全量 28 files/137 tests，本地门禁 exit 0 |
| EVD-M1-004-E | M1-004 | 2026-09-09 21:08 +08:00 | `pnpm lint`; `pnpm typecheck`; `pnpm build`; focused 2 files/7 tests; `pnpm test`; `pnpm test:integration`; `pnpm api:smoke`; `pnpm docker:smoke` | search 统一返回 `{data,meta:{nextCursor}}`；空/非空 route 与 domain 回归通过，全量 28 files/137 tests，本地门禁 exit 0 |
| EVD-M1-005-C | M1-005 | 2026-09-09 21:40 +08:00 | `pnpm vitest run packages/diary/test/diary.test.ts apps/api/test/diary-routes.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; independent scoped review | 聚焦 diary/API 2 files/9 tests、全量 51 files/258 tests；所有本地命令 exit 0；coverage 按 gramEquivalent 加权，copy 请求级事务回滚通过；独立复审无 Critical/Important/Minor；Docker CLI 缺失由 smoke 如实记录 |
| EVD-M1-006-A | M1-006 | 2026-09-09 22:15 +08:00 | `pnpm vitest run packages/dashboard/test/dashboard.test.ts apps/api/test/dashboard-routes.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `node scripts/dashboard-benchmark.mjs`; independent scoped review | focused 2 files/4 tests、full 94 files/505 tests；全部命令 exit 0，integration 无测试文件正常 exit 0；benchmark n=1000 p50=0.321ms/p95=0.573ms；独立复审 ACCEPTED，无 Critical/Important/Minor；Docker CLI 缺失已记录 |
| EVD-M1-007-A | M1-007 | 2026-09-09 23:20 +08:00 | `pnpm exec vitest run apps/api/test/auth-routes.test.ts apps/api/test/profile-routes.test.ts apps/api/test/static-routes.test.ts apps/web/test`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git diff --check` | focused auth/profile/static/web 5 files/8 tests；full 104 files/533 tests；lint/typecheck/build/API smoke/diff check exit 0；API smoke home/health/ready=200 且命中 web app shell；Docker smoke exit 0 with environment message that Docker CLI is unavailable；视觉截图与 M1-008 E2E 未宣称完成 |
| EVD-M1-007-B | M1-007 | 2026-09-09 23:45 +08:00 | `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git diff --check` | 复审修复后 lint/typecheck/build/API smoke/diff check exit 0；full 104 files/535 tests；integration 无测试文件正常 exit 0；新增 204 logout、非法日期 400、离线状态文案、首次设置用户状态和静态 symlink canonical containment 回归；Docker smoke exit 0 但本机无 Docker CLI |
| EVD-M1-007-C | M1-007 | 2026-09-10 00:15 +08:00 | GitHub Actions run `34342506965`；GHCR manifest 查询 | verify 与多架构 `docker/build-push-action@v6` 均 `success`；`latest` manifest `sha256:483066f93432d4fd3e15458a933dc032b1cf0611c22a9da7fd95c419f1f22d2d`，包含 linux/amd64 与 linux/arm64；本机 Docker CLI 仍未安装 |
| EVD-M1-007-D | M1-007 | 2026-09-10 00:26 +08:00 | `pnpm exec vitest run apps/web/test/bootstrap-validation.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; 浏览器首次设置实测 | TDD 聚焦 1 file/3 tests；全量 105 files/538 tests；lint/typecheck exit 0；浏览器输入 11 位密码时提交前显示“密码至少需要 12 个字符”，不会发 bootstrap 请求；当前浏览器适配器实测视口 527px 无横向溢出，目标 360/390/430 截图仍待补齐 |
| EVD-M1-008-A | M1-008 | 2026-09-10 00:28 +08:00 | `pnpm exec vitest run apps/api/test/m1-e2e.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git diff --check` | 聚焦 1 file/1 test；全量 106 files/539 tests；lint/typecheck/test/build/API smoke/diff check exit 0；golden flow 覆盖导入/搜索/记录/修改/复制/删除/重启/历史快照/backup restore；docker smoke exit 0 但本机 Docker CLI 不可用 |

后续代码证据应记录具体命令、退出码和关键计数，例如：

```text
pnpm test --filter nutrition-engine
exit: 0
result: 42 passed, 0 failed
```

“已检查”“看起来正常”或只给文件路径不能作为通过证据。

| EVD-M1-009-A | M1-009 | 2026-09-10 01:10 +08:00 | `pnpm exec vitest run apps/web/test/dashboard-view.test.ts apps/web/test/flow.test.ts apps/web/test/search-state.test.ts`; `pnpm test`; `pnpm lint`; `pnpm typecheck`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | 聚焦 3 files/8 tests；全量 108 files/544 tests；所有代码门禁与 API smoke exit 0；docker smoke exit 0 但本机 Docker CLI 不可用；导航五项均有可见状态，空目录搜索有导入说明 |
| EVD-M1-007-E | M1-007 | 2026-09-10 01:25 +08:00 | IAB 本地预览 `http://localhost:3970/`；viewport `360x800`；浏览器 AX/截图；`tab.playwright.evaluate` 布局测量；命令行登录后搜索 API 请求 | 360px 首页截图可见；`documentWidth=345`、`bodyWidth=345`、无横向溢出；今日/饮食/体重/分析/我的五项导航均切换到可见状态；命令行搜索返回 200 空数组；IAB 搜索请求被 `ERR_BLOCKED_BY_CLIENT` 拦截，390/430 viewport override 不生效，M1-007 保持 BLOCKED |
| EVD-M2-001-A | M2-001 | 2026-09-10 01:55 +08:00 | `pnpm exec vitest run packages/nutrition-engine/test/nutrition-engine.test.ts packages/profile/test/profile.test.ts apps/api/test/profile-routes.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | TDD 先以缺失函数失败，再实现后聚焦测试通过；全量 110 files/588 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用；BMR/TDEE、调整量、手动覆盖和估算 API 均有回归 |
| EVD-M2-002-A | M2-002 | 2026-09-10 02:25 +08:00 | `pnpm exec vitest run packages/body/test/body.test.ts apps/api/test/body-routes.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | TDD 先观察路由 404/域模块缺失，再实现后聚焦 2 files/4 tests；全量 123 files/647 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用；同日多次、timezone localDate、版本更新/删除冲突和 REST 路由通过 |
| EVD-M2-003-A | M2-003 | 2026-09-10 02:55 +08:00 | `pnpm exec vitest run packages/body/test/body.test.ts apps/api/test/body-routes.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | TDD 先观察 sampling/trend 函数缺失，再实现后聚焦 2 files/7 tests；全量 123 files/653 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用；last/average、rolling/EWMA、窗口/alpha 校验、缺失日期和 trend API 通过 |
| EVD-M2-004-A | M2-004 | 2026-09-10 03:25 +08:00 | `pnpm exec vitest run packages/analytics/test/analytics.test.ts apps/api/test/analytics-routes.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | TDD 先观察 analytics 模块缺失，再实现后聚焦 2 files/4 tests；全量 138 files/724 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用；覆盖率、平均摄入/宏量、goal difference、weight delta 和不足数据 null 语义通过 |
| EVD-M2-005-A | M2-005 | 2026-09-10 03:55 +08:00 | `pnpm exec vitest run packages/analytics/test/analytics.test.ts apps/api/test/analytics-routes.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | TDD 先观察 Adaptive 函数缺失，再实现后聚焦 2 files/7 tests；全量 138 files/730 tests；lint/typecheck/build/API smoke/diff check exit 0；docker smoke exit 0 但本机 Docker CLI 不可用；21 天/8 次/coverage 门槛、固定公式、平滑、7 天节流和不自动改目标通过 |
| EVD-M2-006-A | M2-006 | 2026-09-10 04:10 +08:00 | `pnpm exec vitest run apps/web/test/dashboard-view.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke`; `git -c safe.directory='D:/AI编程/体重管理' diff --check`; 30 天 EWMA 100 次本地基准 | 聚焦 Web 1 file/3 tests；全量 138 files/731 tests；lint/typecheck/build/API smoke/test:integration/diff check exit 0；EWMA p50 0.061ms、p95 0.135ms、max 11.989ms；docker smoke exit 0 但本机 Docker CLI 不可用；IAB/viewport 限制导致 M2-006 保持 BLOCKED |
| EVD-M2-006-B | M2-006 | 2026-09-10 06:30 +08:00 | `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check`; 本地 Chromium Playwright 截图 | 全量 138 files/732 tests；integration 无测试文件正常 exit 0；lint/typecheck/build/API smoke/diff check exit 0；Playwright 1 passed，覆盖 bootstrap/login/logout、食物搜索成功/空状态、记账、体重写入、分析不足、44px 导航命中区和 360/390/430 无横向溢出，三档截图写入 test-results 并被 gitignore；BLK-007 解除 |
| EVD-M1-007-F | M1-007 | 2026-09-10 07:05 +08:00 | `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | 全量 138 files/733 tests；integration 无测试文件正常 exit 0；Playwright 1 passed，真实 Chromium 覆盖编辑 100→120g、复制昨日整天入口、删除确认、搜索成功/空状态、体重写入、分析不足、登录/退出、44px 命中区和 360/390/430 无横向溢出；M1-007 退出门槛通过 |
| EVD-M3-001-A | M3-001 | 2026-09-10 07:20 +08:00 | PowerShell：5 个文档存在/非空、ADR 5 项 contract 术语、DEC-006=ACCEPTED、`git -c safe.directory='D:/AI编程/体重管理' diff --check` | exit 0；snapshot 字段、cache 失效、单向 food projection、显式 refresh/warning、recipe-to-diary 边界和 `recipe_yield_v1` 术语检查通过；ADR 仍待用户审阅，任务保持 IN_PROGRESS |
| EVD-M3-001-B | M3-001 | 2026-09-09 22:39 +08:00 | 计划自检：检查 `docs/superpowers/plans/2026-09-09-recipe-calculation-api.md` 的 spec coverage、placeholder scan、type consistency；`git diff --check` | exit 0；M3-002 计划覆盖计算、持久化、刷新、cache、复制、编辑、删除、日记快照、API 和交接证据；无 TBD/TODO/未定义接口；进入 M3-002 |
| EVD-M3-002-A | M3-002 | 2026-09-10 04:21 +08:00 | `pnpm exec vitest run packages/db/test/schema.test.ts packages/recipe/test/recipe.test.ts`; `pnpm typecheck`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | 聚焦 2 files/5 tests passed；迁移重复执行、四张 recipe 表、version/deleted_at、cache invalidated_at、状态约束通过；typecheck 和 diff check exit 0；提交 `8466d8b` |
| EVD-M3-002-B | M3-002 | 2026-09-10 04:24 +08:00 | `pnpm exec vitest run packages/recipe/test/recipe.test.ts packages/nutrition-engine/test/nutrition-engine.test.ts`; `pnpm typecheck`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | 2 files/14 tests passed；total/per100g/perServing、coverage、trace/estimated/unknown warnings、缺少 yield 语义和非正分母校验通过；typecheck/diff check exit 0；提交 `245b702` |
| EVD-M3-002-C | M3-002 | 2026-09-10 04:32 +08:00 | `pnpm exec vitest run packages/recipe/test/recipe.test.ts`; `pnpm typecheck`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | recipe tests 8 passed；create/source snapshot、food revision isolation、explicit refresh/unavailable warning、cache rebuild、copy/delete/version conflict passed；typecheck/diff check exit 0；提交 `1480a3c` |
| EVD-M3-002-D | M3-002 | 2026-09-10 04:36 +08:00 | `pnpm exec vitest run packages/diary/test/diary.test.ts packages/recipe/test/recipe.test.ts`; `pnpm typecheck`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | 2 files/22 tests passed；recipe diary writer、recipe_id/source snapshot、food update 后历史不漂移、非法餐次事务回滚和 add-to-diary per100g scaling 通过；typecheck/diff check exit 0；提交 `8403c90` |
| EVD-M3-002-E | M3-002 | 2026-09-10 04:40 +08:00 | `pnpm exec vitest run apps/api/test/recipe-routes.test.ts apps/web/test/api.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm build`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | API/Web 2 files/5 tests passed；recipe routes、version conflict、copy/refresh/add/delete、client credentials/encoding 通过；lint/typecheck/build/diff check exit 0；提交 `1d5f701` |
| EVD-M3-002-F | M3-002 | 2026-09-10 04:50 +08:00 | `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | lint/typecheck/build/API smoke/diff check exit 0；integration 无测试文件并正常 exit 0；全量 174 files/993 tests passed；Playwright 1 passed，覆盖首次设置、登录、搜索、添加/编辑/复制/删除、体重写入、分析不足及 360/390/430 无横向溢出；时区日期回归与日期依赖闭包修复通过 |
| EVD-M3-003-A | M3-003 | 2026-09-10 07:01 +08:00（历史基线，已被终审修复 supersede） | `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | 首轮全部 exit 0；全量 176 files/1017 tests passed；integration 无匹配测试文件并正常 exit 0；build 产物生成成功；API smoke 的 home/health/ready 均 200；Playwright 1 passed，覆盖菜谱生命周期、snapshot 稳定性及 360/390/430 viewport；本机 Docker CLI 缺失，未宣称容器验证；实现提交 `b52b976`、`895594a`、`7958351`、`fdc3b2c`、`9523abe`、`85d3865`、`7efb600`、`2d0c343`、`d5dad06`；终审发现后不再作为当前 DONE 证据 |
| EVD-M3-003-B | M3-003 | 2026-09-10 08:08 +08:00 | `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | 全部 exit 0；全量 176 files/1031 tests passed；integration 无匹配测试文件并正常 exit 0；build 成功；API smoke 的 home/health/ready 均 200；Playwright 1 passed（7.1s），覆盖菜谱创建/搜索/计算结果/warning/复制/编辑/刷新/删除/加入日记 snapshot 稳定性，以及 360/390/430 viewport 无溢出和 44px 命中区；本机 Docker CLI 缺失，未宣称本地容器验证；修复提交 `85aa305`、`65e1029`、`450cc46`、`1bd4267`、`0514e52`、`8cf3d48`、`1916a57`、`26ab2d0`、`96d7367`、`fe5228f`、`09583eb`、`9738704` |
| EVD-M3-008-A | M3-008 | 2026-09-10 20:10 +08:00 | `pnpm vitest run apps/web/test/diary-page.test.tsx apps/web/test/dashboard-view.test.ts`; `pnpm test`; `pnpm lint`; `pnpm typecheck`; `pnpm build`; `pnpm exec playwright test e2e/ui-regression.spec.ts`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | RED 先验证四餐入口契约缺失；GREEN 聚焦 2 files/11 tests；全量 182 files/1063 tests；lint/typecheck/build/diff check exit 0；单文件 Playwright 1 passed、全量 E2E 2 passed（workers=1），覆盖四餐按钮、目标餐次预选、搜索框焦点、44px 命中区和 360/390/430/1024/1440 视口；本机 Docker CLI 缺失，仅未执行容器实测 |
| EVD-M1-010-A | M1-010 | 2026-09-10 20:40 +08:00 | `pnpm vitest run tools/food-import/test/food-import.test.ts tools/food-import/test/remote-food.test.ts`; `pnpm test`; `pnpm lint`; `pnpm typecheck`; `pnpm build`; `pnpm test:integration`; `pnpm api:smoke`; `pnpm test:e2e`; `pnpm docker:smoke`; `git -c safe.directory='D:/AI编程/体重管理' diff --check`; 真实 `node scripts/food-remote-import.mjs` 临时 SQLite 两次 | RED 先暴露远程模块缺失、`899*` footnote 和 `un` unknown marker；GREEN 聚焦 2 files/12 tests、全量 183 files/1067 tests；真实远程 61 files/1677 foods 首次 `promoted`、二次 `already_promoted`，checksum `76b5f360c3286e1a14c9e1c586335f3cae06ea9afed6acdce198998cda643ea2`；lint/typecheck/build/integration/API smoke/E2E 2/diff check exit 0；docker smoke exit 0 但 Docker CLI 不可用 |
| EVD-M1-011-A | M1-011 | 2026-09-10 11:50 +08:00 | `pnpm vitest run apps/web/test/api.test.ts`; `pnpm test`; `pnpm lint`; `pnpm typecheck`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | RED 先复现 `crypto.randomUUID is not a function`；GREEN 新增非安全局域网 HTTP 幂等键回退；focused 1 file/6 tests、全量 183 files/1068 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0 |
| EVD-M3-009-A | M3-009 | 2026-09-10 22:50 +08:00 | `pnpm vitest run apps/web/test/today-page.test.tsx`; `pnpm test`; `pnpm lint`; `pnpm typecheck`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | RED 先复现超预算负数展示；GREEN 完成“今日热量”卡、空日 `0 kcal`/完整剩余预算、超预算 `0 kcal`/超出说明和无目标不可用语义；focused 6 tests、全量 183 files/1070 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0 |
| EVD-M3-010-A | M3-010 | 2026-09-10 23:20 +08:00 | `pnpm vitest run apps/web/test/today-page.test.tsx apps/web/test/weight-page.test.tsx`; `pnpm test`; `pnpm lint`; `pnpm typecheck`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | RED 先复现趋势卡缺失；GREEN 完成最近 7 天真实记录门禁、最新体重/变化摘要、服务端趋势共享图表和移动端样式；focused 2 files/14 tests、全量 183 files/1073 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0；趋势请求失败时隐藏可选摘要，不阻塞今日主流程 |
| EVD-M3-011-A | M3-011 | 2026-09-10 23:45 +08:00 | `pnpm vitest run apps/web/test/today-page.test.tsx apps/web/test/dashboard-view.test.ts`; `pnpm test`; `pnpm lint`; `pnpm typecheck`; `pnpm build`; `pnpm api:smoke`; `pnpm test:e2e`; `git -c safe.directory='D:/AI编程/体重管理' diff --check` | RED 先复现今日页缺少饮食卡/四餐入口/空状态；GREEN 完成四餐“＋ 添加”、总入口、无记录空状态、目标餐次映射、搜索面板聚焦和动态“加入餐次”按钮；focused 2 files/17 tests、全量 183 files/1076 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed（含首页按钮与午餐聚焦回归）、diff check 均 exit 0 |

## 9. 问题队列

完整缺口见 `PLAN_REVIEW.md`。当前优先处理顺序：

1. GAP-009：SQLite/Drizzle 技术门；
2. GAP-002/003：bootstrap 与 session；
3. GAP-004/005/006：幂等、乐观锁、scheduler 幂等；
4. GAP-011/012：原子恢复和完整 DDL 语义；
5. GAP-007/008：菜谱与每日汇总快照不一致；
6. GAP-101 至 GAP-114：在相应里程碑进入开发前关闭。

新增问题格式：

```text
ISSUE-<三位序号> | 发现时间 | 影响任务 | 严重度 | 现象 | 建议下一步 | 状态
```

`ISSUE-115 | 2026-09-10 00:20 +08:00 | M1-007 | P2 | 首次设置密码少于 12 个字符时只显示通用请求失败 | 前端预校验并映射明确错误文案 | RESOLVED，见 EVD-M1-007-D`

`ISSUE-116 | 2026-09-10 00:45 +08:00 | M1-007 | P1 | Dashboard 底部导航按钮没有动作；本地食物目录为空时搜索只返回空数组且没有空状态/导入入口 | 接入导航状态与页面、增加食物目录导入或明确空状态引导，并补 UI/E2E 验收 | RESOLVED，见 EVD-M1-009-A`

`ISSUE-117 | 2026-09-10 04:45 +08:00 | M3-002 | P1 | 浏览器 UTC 日期与用户时区 localDate 不一致，且日期加载回调捕获初始日期，导致体重/饮食新增后列表为空但趋势可见 | 使用 profile timezone 计算本地日期，补依赖与回归测试，并重建 E2E dist | RESOLVED，见 EVD-M3-002-F`

`ISSUE-118 | 2026-09-10 11:37 +08:00 | M1-011 | P1 | 飞牛以局域网 HTTP 地址访问时，饮食加入动作调用不可用的 `crypto.randomUUID()`，请求未发出即显示“网络连接失败” | 增加非安全上下文幂等键回退并补回归测试；发布新镜像后强制 pull/recreate | RESOLVED，见 EVD-M1-011-A`

## 10. 活动日志

活动日志只追加，不覆盖历史。敏感数据不得进入日志。

| 时间 | 操作者 | 事件 | 结果/下一步 |
|---|---|---|---|
| 2026-09-09 06:20 +08:00 | Codex | 开始阅读原有规划文档 | 识别产品、架构、DB、API、营养、食物、UI、部署共 8 份规范 |
| 2026-09-09 06:30 +08:00 | Codex | 完成原方案交叉审查 | 方向保留；P0/P1/P2 缺口写入 `PLAN_REVIEW.md` |
| 2026-09-09 06:30 +08:00 | Codex | 开始 DOC-002 | 建立执行路线与实时进度机制，下一步运行文档验证 |
| 2026-09-09 06:38 +08:00 | Codex | 完成 DOC-002 验证 | 新增文件 5/5、原始规范 8/8、内部链接与任务统计全部通过；等待后续决策/开发指令 |
| 2026-09-09 06:43 +08:00 | Codex | 开始 M0-001 | 用户授权初始化 Git 并按路线开发；先建立版本控制和隔离工作区 |
| 2026-09-09 06:45 +08:00 | Codex | Git 基线建立 | `main` 创建并提交 `6ae1c95`；目录 owner 与执行用户不同，后续 Git 命令使用一次性 `safe.directory`，未改全局配置 |
| 2026-09-09 06:45 +08:00 | Codex | M0-001 等待工作区选择 | 按隔离工作区规则暂停进入业务实现，等待用户确认 worktree 或原地开发 |
| 2026-09-09 06:53 +08:00 | Codex | 完成 M0-001 | `feat/m0-foundation` 已建立；pnpm workspace、TS、Vitest、ESLint、根脚本及最小 shared 测试全部通过 |
| 2026-09-09 06:53 +08:00 | Codex | 开始 M0-002 | 进入 SQLite/ORM 技术门；先验证候选组合再建立数据库 schema |
| 2026-09-09 07:02 +08:00 | Codex | M0-002 阶段验证通过 | 6 项 SQLite/Drizzle 测试与全量门禁通过；新增 `ADR-0001-sqlite-driver.md`，任务保持 `IN_PROGRESS` 直到完整技术门结束 |
| 2026-09-09 07:05 +08:00 | Codex | M0-002 暂停于环境阻塞 | WAL/migration 测试通过，但 Docker CLI 缺失；转入不依赖 Docker 的 M0-003，保留 BLK-005 |
| 2026-09-09 07:08 +08:00 | Codex | 完成 M0-003 | Clock、时区日期、UUIDv7、配置优先级、secret redaction、错误 envelope 测试与全量门禁通过 |
| 2026-09-09 07:08 +08:00 | Codex | 开始 M0-004 | 在候选 SQLite 上建立真实 core/profile schema 与 migration fixtures |
| 2026-09-09 07:20 +08:00 | Codex | 完成 M0-004 | schema bootstrap、重复/失败 migration、foreign key、checksum 约束和全量门禁通过；新增 EVD-M0-004-A |
| 2026-09-09 07:20 +08:00 | Codex | 开始 M0-005 | 进入备份/恢复最小闭环，先以 manifest 与损坏备份拒绝恢复为测试入口 |
| 2026-09-09 07:27 +08:00 | Codex | 完成 M0-005 | backup manifest、SHA-256/字节数、integrity_check、临时文件恢复和损坏备份保护测试通过；新增 EVD-M0-005-A |
| 2026-09-09 07:27 +08:00 | Codex | 开始 M0-006 | 进入首次初始化与鉴权，先固定 bootstrap once、密码与 session 生命周期边界 |
| 2026-09-09 07:35 +08:00 | Codex | 完成 M0-006 | 一次性 bootstrap、scrypt password hash、统一凭据错误、DB session、过期/撤销和 cookie defaults 全量门禁通过；新增 EVD-M0-006-A；BLK-002 解除 |
| 2026-09-09 07:35 +08:00 | Codex | 开始 M0-007 | 进入 Dockerfile、Compose、health/readiness 与 CI 静态基线；真实 Docker smoke 仍受 BLK-005 影响 |
| 2026-09-09 07:45 +08:00 | Codex | M0-007 静态基线完成但受阻 | Dockerfile/Compose/healthcheck/CI 与 API health/readiness smoke 已通过；Docker CLI/Buildx 缺失，新增 EVD-M0-007-A，M0 保持 IN_PROGRESS |
| 2026-09-09 07:50 +08:00 | Codex | 加强 M0-007 可重复验证 | 新增 `pnpm api:smoke` 并纳入 CI；构建后 smoke 通过，Docker CLI 缺失继续记录为 BLK-005 |
| 2026-09-09 08:00 +08:00 | Codex | 修复首次 GitHub CI 安装失败 | 远程 run `34291079576` 在 `pnpm install --frozen-lockfile` 失败；将 `allowBuilds` 占位值修正为 `esbuild: true`，本地强制重链和完整门禁通过，准备推送修复 |
| 2026-09-09 08:20 +08:00 | Codex | M0 完成并开始 M1 | 远程 run `34291487487` verify 与 amd64/arm64 Docker buildx 均成功；接受 DEC-004，解除 BLK-001/005，M0 7/7 DONE；开始 M1-001 Nutrition Engine |
| 2026-09-09 08:40 +08:00 | Codex | 修正镜像发布流程并完成 GHCR 发布 | 发现原 workflow 仅 `push: false`、只做构建校验；改为 main 登录 GHCR 并 push `latest`/SHA 标签，run `34292835823` 成功，镜像已可拉取 |
| 2026-09-09 09:12 +08:00 | Codex | 处理飞牛拉取后启动失败 | 运行时补复制 `apps/api/node_modules`；Compose 启动前修正 `/data` 权限并降权到 `appuser`；本地门禁通过，准备推送并等待新的 GHCR 镜像 |
| 2026-09-09 09:18 +08:00 | Codex | 新镜像远程验证完成 | main run `34293880647` 与 feature run `34293870807` 均成功；GHCR `latest` 已更新为 `401da83`，等待飞牛重新拉取并启动 |
| 2026-09-09 09:28 +08:00 | Codex | 修复飞牛 Compose shell 参数解析 | 日志确认 `chown` 缺少操作数；将 entrypoint 改为三段式数组，提交 `3d41734` 已同步到 `main`；飞牛只需替换 Compose 并强制重建，无需改数据目录 |
| 2026-09-09 09:46 +08:00 | Codex | 处理访问根路径显示 `NOT_FOUND` | 确认当前版本为 API 基础版，新增根路径中文运行状态页；新增 smoke 断言 `home=200`，本地验证通过，准备发布新镜像 |
| 2026-09-09 09:55 +08:00 | Codex | 根路径首页镜像发布完成 | main run `34296265518` 成功；GHCR `latest` 已更新，飞牛重新拉取后访问 `/` 将显示服务状态页 |
| 2026-09-09 10:00 +08:00 | Codex | 完成 M1-001 Nutrition Engine 基础 | 先观察模块缺失的失败测试；新增纯计算、状态/coverage 和展示取整 golden tests；所有本地门禁通过，Docker CLI 缺失由 smoke 脚本记录 |
| 2026-09-09 10:05 +08:00 | Codex | M1-001 review 修复开始 | P1：estimated 被计入 known coverage；先以 coverage=0.5 失败断言复现，再以最小修复恢复验收 |
| 2026-09-09 10:15 +08:00 | Codex | 完成 M1-001 review 修复 | estimated 仍计入营养总量和 hasEstimated，但 coverage 分子只计 known；新 RED/GREEN 和相关门禁均通过 |
| 2026-09-09 18:10 +08:00 | Codex | 完成 M1-002 Food canonical schema | 新增前向 food migration、canonical/staging/FTS5 表与约束；先观察 migration 缺失 RED，再完成 7 个 schema tests 和全量门禁 |
| 2026-09-09 18:20 +08:00 | Codex | 开始 M1-002 审查修复 | 计划以跨 food/source 和跨 staging dataset/item 的错配回归测试验证复合外键，再运行完整门禁 |
| 2026-09-09 18:20 +08:00 | Codex | 完成 M1-002 审查修复 | 两个错配回归断言先失败，复合唯一键/外键后聚焦 7 tests 与全量 35 tests 通过 |
| 2026-09-09 18:25 +08:00 | Codex | 开始 M1-003 Food import staging pipeline | 读取 FOOD_DATA_SPEC 与 M1-003 路线要求；先固定 parse/staging/validate/normalize/diff/promote contract，保持 active catalog 隔离 |
| 2026-09-09 18:28 +08:00 | Codex + delegated implementer | M1-003 实现完成，等待复审 | 完成离线 parse/stage/validate/normalize/diff/promote/FTS pipeline；20 条合成 fixture 覆盖 raw 状态、幂等、隔离、rollback 与 FTS；全量门禁通过，Docker CLI 缺失已如实记录 |
| 2026-09-09 18:37 +08:00 | Codex + delegated implementer | 完成 M1-003 审查修复 | 新增 `0004` 前向迁移保留旧营养行并允许 `kJ`、加入 source remark；metadata 完整的结构失败进入 failed staging；非法数值拒绝且不会变为 unknown；复审回归与全量门禁通过 |
| 2026-09-09 20:30 +08:00 | Codex | 完成 M1-003 最终范围复审与幂等修复 | 修复 malformed same-identity 文档不可降级 promoted staging；聚焦 16 tests、全量 64 tests 和全部本地门禁通过；进入 M1-004 |
| 2026-09-09 20:35 +08:00 | Codex | 开始 M1-004 Food search/detail API | 固定本地查询、custom/reference 写边界、alias/serving/favorite 与无网络 fallback contract；先写 domain/route RED tests |
| 2026-09-09 21:10 +08:00 | Codex | 完成 M1-004 最终复审 | 三轮独立复审完成；search envelope、indexed prefix/FTS、PATCH validation/revision、reference user additions 与事务边界均通过；进入 M1-005 |
| 2026-09-09 21:15 +08:00 | Codex | 开始 M1-005 Diary domain 与 snapshot | 读取 API/DB/roadmap；先固定快照、幂等、复制 fallback 与 optimistic concurrency contract |
| 2026-09-09 21:20 +08:00 | Codex + delegated implementer | 完成 M1-005 Diary domain 与 snapshot | 先观察 diary domain 缺失/API 404 RED；`0007`、已存营养快照、幂等、版本冲突、复制 fallback 和核心 REST API 完成；聚焦 5 tests、全量 250 tests 与全部本地门禁通过，Docker CLI 缺失如实记录 |
| 2026-09-09 21:30 +08:00 | Codex + delegated implementer | 修复 M1-005 独立复审问题 | 新增 `0008` serving 身份迁移；day 返回存储快照 meal/daily totals 与 coverage；copy-day API/domain、active serving 重新解析和 snapshot fallback 回归通过；聚焦 7 tests、全量 254 tests 与全部本地门禁通过 |
| 2026-09-09 21:35 +08:00 | Codex + delegated implementer | 修复 M1-005 follow-up 复审问题 | coverage 按 `gram_equivalent` 加权，known 才计 covered；copy-meal/day 改为请求级单一事务，后续 serving 失败可回滚先前复制；聚焦 8 tests、lint/typecheck 均 exit 0 |
| 2026-09-09 20:42 +08:00 | Codex + delegated implementer | M1-004 实现完成，等待复审 | 本地 search/detail/custom/alias/serving/favorite 路由和 domain 已完成；聚焦 4 tests、全量 131 tests 与门禁通过；100k 性能未测量并已记录限制 |
| 2026-09-09 20:52 +08:00 | Codex + delegated implementer | M1-004 复审修复完成，等待确认 | nested custom transaction、source revision、FTS/keyset、error envelope、reference user additions 和 strict cursor 回归均通过；全量 135 tests |
| 2026-09-09 21:02 +08:00 | Codex + delegated implementer | M1-004 最终复审修复完成，等待确认 | `0005` search key/index、strict PATCH body 和 optional nutrient revision upsert 已覆盖；全量 137 tests |
| 2026-09-09 21:06 +08:00 | Codex + delegated implementer | M1-004 NOCASE prefix 与 empty-array 修复完成 | 新增 `0006` 前向索引，prefix EXPLAIN 使用 NOCASE index；`nutrients: []` 返回 validation envelope；全量 137 tests |
| 2026-09-09 21:40 +08:00 | Codex + independent reviewer | 完成 M1-005 最终 scoped re-review | 聚焦 diary/API 2 files/9 tests、typecheck 通过；coverage 与复制事务问题均确认修复，无 Critical/Important/Minor；M1-005 标记 DONE，下一步进入 M1-006 |
| 2026-09-09 21:45 +08:00 | Codex | 开始 M1-006 Dashboard read model 设计 | 已读 README、PRODUCT_SPEC、API_SPEC、DATABASE_SCHEMA、NUTRITION_ENGINE_SPEC 与路线图；记录 goal snapshot 绑定决策点，计划先获确认再实现 |
| 2026-09-09 22:15 +08:00 | Codex + independent reviewer | 完成 M1-006 Dashboard read model | `0009`、goal snapshot、snapshot-only Dashboard、cache rebuild、API envelope 与 benchmark 完成；全量 94 files/505 tests、所有本地门禁 exit 0；进入 M1-007 |
| 2026-09-09 22:35 +08:00 | Codex | 确认 M1-007 扩展范围 | 用户确认实现登录 + 首次设置完整流程；接受 DEC-009；下一步先完成实施计划和 HTTP contract，再进入 TDD |
| 2026-09-09 23:20 +08:00 | Codex | 完成 M1-007 核心实现阶段 | 新增 profile/goal service、HTTP auth/session guard、React/Vite onboarding/dashboard、静态资源服务与 Docker web copy；本地门禁通过；视觉基线、Docker 实测和 M1-008 E2E 留待后续 |
| 2026-09-09 23:25 +08:00 | Codex | 修正 web runtime 依赖交付 | 发现 Docker runtime 只复制 db workspace 包，补为复制全部 workspace packages；同时修正 SPA fallback 的 shell 缓存头；聚焦静态/auth/profile/web 8 tests、lint/typecheck/build/API smoke/diff check 均通过，提交 `b5c7956` |
| 2026-09-09 23:35 +08:00 | Codex | 修复独立复审发现的问题 | 修复 204 logout JSON 解析、非法日期 500、离线 banner/重试、首次设置用户状态和静态 symlink 路径校验；focused 10 tests、build/lint/typecheck 通过；等待复审复核 |
| 2026-09-09 23:45 +08:00 | Codex | 完成复审修复后的全量验证 | full 104 files/535 tests；integration、lint、typecheck、build、API smoke、diff check 均 exit 0；Docker smoke 如实记录 Docker CLI 不可用；M1-007 仍等待目标 viewport 视觉基线后关闭 |
| 2026-09-09 23:55 +08:00 | Codex | 合并后远程 CI 首次验证失败 | run `34341237744` 的 verify 中 lint/typecheck/test/build/API smoke 全部成功，仅重复 `pnpm docker:smoke` 失败，导致 docker 发布 job 被跳过；登记 `BLK-006`，将验证与镜像构建职责拆开后重跑 |
| 2026-09-10 00:05 +08:00 | Codex | 定位 Docker build 根因并完成 RED 复现 | run `34341890201` 的 Docker job 失败于 Dockerfile `pnpm build`；干净 context 移除 `tools/` 后本地复现 `TS5083`，确认根因是 build stage 未复制 `tools/food-import`；补充 `COPY tools ./tools`，等待远程复验 |
| 2026-09-10 00:15 +08:00 | Codex | main 合并与 GHCR latest 发布完成 | `main` 已推送至 `3a47945`；run `34342506965` verify/Docker 均 success；GHCR `latest` 已更新为 amd64/arm64 多架构镜像；飞牛后续直接 pull `latest`，下一步进行 360/390/430 视觉验收与 M1-008 E2E |
| 2026-09-09 07:10 +08:00 | Codex | 开始 DOC-004 | 用户指定公开 GitHub 仓库作为后续 Docker 内容承载位置；先建立发布白名单、排除项与上传前验收，当前不上传 |
| 2026-09-09 07:12 +08:00 | Codex | 完成 DOC-004 验证 | README 与 Docker 部署规范已同步发布边界、排除项、发布闸门和镜像标签方法；文档检查通过；未执行远程绑定、push、Actions 或 GHCR 操作 |
| 2026-09-10 00:20 +08:00 | Codex | 开始处理 ISSUE-115 | 飞牛首次设置反馈显示短密码只得到通用错误；按 TDD 增加前端校验、错误码映射与最小长度属性 |
| 2026-09-10 00:24 +08:00 | Codex | 开始 M1-008 | 固定无公网 HTTP + SQLite golden flow，覆盖食物导入到备份恢复的完整数据链路 |
| 2026-09-10 00:26 +08:00 | Codex | 完成 ISSUE-115 修复与 M1-007 局部验收 | 聚焦 3 tests、全量 105 files/538 tests、lint/typecheck 通过；浏览器实测短密码在提交前得到明确提示；目标 360/390/430 截图仍待适配器支持 |
| 2026-09-10 00:28 +08:00 | Codex | 完成 M1-008 集成验收 | 聚焦 1 test、全量 106 files/539 tests；lint/typecheck/build/API smoke/diff check exit 0；重启、历史 snapshot 不漂移和 backup restore 通过；本机 Docker CLI 缺失如实记录 |
| 2026-09-10 00:45 +08:00 | Codex | 登记 ISSUE-116 | 用户反馈更新后除退出外按钮无效；代码核查确认底部导航尚未绑定动作，搜索仅查询本地 active catalog，空目录时无结果提示；待后续实现，不在本次诊断中扩大范围 |
| 2026-09-10 00:55 +08:00 | Codex | 开始 M1-009 | 用户确认从第一性原理继续开发；已写入导航/空状态 spec 与实施计划，任务进入 IN_PROGRESS，先执行导航状态模型的 RED 测试 |
| 2026-09-10 01:10 +08:00 | Codex | 完成 M1-009 | 补充 Dashboard 导航与空状态 HTML 渲染回归；聚焦 3 files/8 tests、全量 108 files/544 tests，lint/typecheck/build/API smoke/diff check 通过；docker smoke 仅记录本机 Docker CLI 缺失；ISSUE-116 已关闭，下一步补 M1-007 目标 viewport 视觉证据 |
| 2026-09-10 01:15 +08:00 | Codex | 继续 M1-007 视觉验收 | 按计划准备采集 360/390/430 viewport 证据，并验证导航切换、空搜索状态和无横向溢出；若当前环境缺少浏览器运行时，将记录为验收阻塞 |
| 2026-09-10 01:25 +08:00 | Codex | M1-007 动态验收环境阻塞 | 360px 首页截图、无横向溢出和五项导航切换已通过；浏览器直接访问本地搜索 API 被 `ERR_BLOCKED_BY_CLIENT` 拦截，命令行同一会话请求返回 200 空数组；继续采集 390/430 静态证据，动态搜索留待真实浏览器/CI |
| 2026-09-10 01:40 +08:00 | Codex | 开始 M2-001 | M1-007 的 IAB 视觉阻塞不影响纯计算/API 工作；先固定 BMR/TDEE、调整量和手动覆盖 contract，按 TDD 记录 RED/GREEN |
| 2026-09-10 01:55 +08:00 | Codex | 完成 M2-001 | `energy_estimate_v1`、profile 估算服务和 goals estimate API 完成；全量 110 files/588 tests 与本地门禁通过；下一步进入 M2-002 体重记录，BLK-007 继续影响 M1-007 视觉验收 |
| 2026-09-10 02:05 +08:00 | Codex | 开始 M2-002 | 读取 Body/API/趋势规范；先建立 `body_weight_entry` 迁移和独立 body domain，暂不实现趋势采样与 UI |
| 2026-09-10 02:25 +08:00 | Codex | 完成 M2-002 | 体重迁移、同日多次记录、timezone localDate、列表范围、乐观版本更新/删除和鉴权 REST 路由完成；全量 123 files/647 tests 与本地门禁通过；下一步进入 M2-003 趋势引擎 |
| 2026-09-10 02:35 +08:00 | Codex | 开始 M2-003 | 固定 body trend 的 sampling、rolling/EWMA、缺失日期和版本参数；先写纯函数 RED 测试，暂不扩展 analytics UI |
| 2026-09-10 02:55 +08:00 | Codex | 完成 M2-003 | `sampleDailyWeights`、`calculateWeightTrend` 与 `GET /api/v1/body/weight-trend` 完成；全量 123 files/653 tests 与本地门禁通过；下一步进入 M2-004 Analytics read model |
| 2026-09-10 03:05 +08:00 | Codex | 开始 M2-004 | 固定 analytics overview 的 period、coverage、平均摄入/宏量、goal difference 和 weight delta；先写纯 read-model RED 测试 |
| 2026-09-10 03:25 +08:00 | Codex | 完成 M2-004 | 独立 analytics package 与 overview API 完成；全量 138 files/724 tests 与本地门禁通过；下一步进入 M2-005 Adaptive TDEE v1 |
| 2026-09-10 03:35 +08:00 | Codex | 开始 M2-005 | 固定 Adaptive TDEE 输入/输出、21/28 天门槛、confidence、7 天节流和 smoothing；先写纯函数 RED 测试 |
| 2026-09-10 03:55 +08:00 | Codex | 完成 M2-005 | `estimateAdaptiveTdee` 与 TDEE API 完成；全量 138 files/730 tests 与本地门禁通过；下一步进入 M2-006 UI/E2E |
| 2026-09-10 03:55 +08:00 | Codex | 开始 M2-006 | 接入体重/趋势/overview/TDEE 到 Dashboard，先写 WeightPanel/AnalyticsPanel 的空态和不足数据测试 |
| 2026-09-10 04:10 +08:00 | Codex | M2-006 代码完成但验收阻塞 | 前端接入和 30 天趋势性能通过；真实浏览器 E2E、390/430 viewport 仍受 BLK-007 阻塞，任务保持 BLOCKED |
| 2026-09-10 04:20 +08:00 | Codex | 恢复 M2-006 浏览器验收 | 读取路线与 UI/API 规范；新增 Playwright Chromium CI 路径和临时受控食物 seed，计划验收首次设置/登录、搜索、记账、体重、分析不足和 360/390/430 viewport |
| 2026-09-10 06:30 +08:00 | Codex | 完成 M2-006，解除 BLK-007 | 修复 Web API 搜索二次解包和 diary `mealSlots + entries` 映射；全量 732 tests、Playwright 1 passed、三档截图/无横向溢出/44px 命中区通过；M2 6/6 DONE；复核发现 M1-007 仍缺记录编辑/复制/删除 UI，下一步回到 M1-007 |
| 2026-09-10 06:55 +08:00 | Codex | 开始 M1-007 记录操作补齐 | 用户确认按后续规划继续；先写 Dashboard 现有记录的编辑/删除/复制动作回归测试，复用现有 PATCH/DELETE/copy API，不新增迁移 |
| 2026-09-10 07:05 +08:00 | Codex | 完成 M1-007，M1 9/9 DONE | 新增 inline 编辑、删除确认、复制昨日整天/单餐和 API client；RED/GREEN、全量 733 tests、Playwright 编辑/删除/复制与三档 viewport 门禁通过；下一步进入 M3-001 |
| 2026-09-10 07:20 +08:00 | Codex | 开始 M3-001 | 读取菜谱 API/数据库/营养规范；形成 ADR-0002，决定 ingredient nutrient snapshot、显式刷新、cache 失效、单向 food projection 和 recipe-to-diary snapshot 边界；等待审阅后进入 M3-002 |
| 2026-09-09 22:39 +08:00 | Codex | 完成 M3-001 并开始 M3-002 | 用户确认继续后续开发；ADR-0002/DEC-006 contract 已接受，M3-002 实施计划已保存，任务进入 IN_PROGRESS；下一步执行 schema/calculation RED 测试 |
| 2026-09-10 04:21 +08:00 | Codex | 完成 M3-002 Task 1 | 先观察 migration/package RED，再实现并通过 2 files/5 tests、typecheck、diff check；提交 `8466d8b`；下一步执行 Task 2 recipe calculation RED |
| 2026-09-10 04:24 +08:00 | Codex | 完成 M3-002 Task 2 | 先观察 calculator RED，再实现 `recipe_yield_v1` 并通过 2 files/14 tests、typecheck、diff check；提交 `245b702`；下一步执行 Task 3 persistence/cache/refresh RED |
| 2026-09-10 04:32 +08:00 | Codex | 完成 M3-002 Task 3 | 先观察 service RED，再实现 snapshot persistence、cache rebuild、explicit refresh、copy/delete/version conflict 并通过 8 tests、typecheck、diff check；提交 `1480a3c`；下一步执行 Task 4 diary snapshot writer RED |
| 2026-09-10 04:36 +08:00 | Codex | 完成 M3-002 Task 4 | 先观察 diary writer/addToDiary RED，再实现 recipe-backed diary snapshot 与 per100g scaling 并通过 2 files/22 tests、typecheck、diff check；提交 `8403c90`；下一步执行 Task 5 recipe HTTP API/client RED |
| 2026-09-10 04:40 +08:00 | Codex | 完成 M3-002 Task 5并开始 Task 6 | 先观察 API/Web RED，再实现认证 recipe routes、error envelope、typed client 与规范同步；聚焦 5 tests、lint/typecheck/build/diff check 通过，提交 `1d5f701`；下一步完整验收 |
| 2026-09-10 04:45 +08:00 | Codex | M3-002 完整验收首次发现 E2E 回归 | 体重记录写入后趋势可见但列表为空；确认前端 UTC 日期、用户时区 localDate 和空依赖回调共同造成边界不一致；登记 ISSUE-117，先写时区日期 RED 测试 |
| 2026-09-10 04:48 +08:00 | Codex | 完成 ISSUE-117 修复与 M3-002 最终验收 | 新增 `localDateNow`/时区日期回归，Dashboard/Setup 使用 profile timezone，修正日期依赖闭包；`pnpm build` 后 `pnpm test:e2e` 1 passed；全量 174 files/993 tests、lint/typecheck/integration/build/API smoke/diff check 均 exit 0 |
| 2026-09-10 06:07 +08:00 | Codex | 完成 M3-003 设计规格与实施计划 | 用户确认从第一性原理继续；提交 `e4f1b0a` 写入 UI/E2E 设计规格，新增 `docs/superpowers/plans/2026-09-10-recipe-ui-e2e.md`，完成 spec coverage、placeholder scan、type consistency 自检；下一步执行 Task 1 |
| 2026-09-10 07:01 +08:00 | Codex | 完成 M3-003 菜谱 UI/E2E（历史基线，已被终审发现 supersede） | Task 1–5 独立实现与复审完成；首轮 `pnpm lint`、`pnpm typecheck`、全量 176 files/1017 tests、integration（无匹配文件）、build、API smoke、Playwright 1 passed、diff check 全部 exit 0；本机 Docker CLI 缺失，未执行本地容器验证；随后终审发现 HTTP NAS 兼容、快照编辑边界、详情刷新、空搜索反馈和 E2E 证据缺口，不能据此标记当前 DONE |
| 2026-09-10 07:45 +08:00 | Codex | 继续 M3-003 终审修复 | 已记录并纳入修复提交 `85aa305`、`65e1029`、`450cc46`、`1bd4267`、`0514e52`、`8cf3d48`、`1916a57`、`26ab2d0`；当前仍为 `IN_PROGRESS`，待重新执行完整门禁与复核后再决定是否完成 |
| 2026-09-10 08:08 +08:00 | Codex | 完成 M3-003 终审修复与最终门禁 | 终审修复提交 `85aa305`、`65e1029`、`450cc46`、`1bd4267`、`0514e52`、`8cf3d48`、`1916a57`、`26ab2d0`、`96d7367`、`fe5228f`、`09583eb`、`9738704` 均已复核；完整门禁全部 exit 0，176 files/1031 tests、Playwright 1 passed；M3-003 标记 DONE，下一步进入 M3-004 MET/运动计算；本机 Docker CLI 缺失如实保留 |
| 2026-09-10 08:20 +08:00 | Codex | 开始 DOC-005 | 用户选择第三套 Data Garden 方案，要求从第一性原理重写统一 UI 设计规范；计划覆盖桌面与移动端 shell、今日/饮食/菜谱/体重/分析/我的、按钮功能映射、状态、无障碍和视觉验收；验收命令为 Markdown 结构检查、占位符扫描、链接目标检查和 `git diff --check` |
| 2026-09-10 08:34 +08:00 | Codex | 完成 DOC-005 | `UI_DESIGN_SYSTEM.md` v2.0 完成（613 行、45 个标题、13 个代码块）；六页规范、Data Garden token、桌面三栏、320–1440 响应式、按钮状态、数据可信边界、无障碍和验收清单均已写入；必需章节检查通过、占位符扫描无结果、`git diff --check` exit 0；下一步 M3-004 |
| 2026-09-10 08:52 +08:00 | Codex | 开始 M3-007 | 用户确认基于 Data Garden 规范重构全站 UI；已新增实施计划与 SDD ledger，基线 `pnpm test` 为 176 files/1031 tests passed；任务按共享壳层、六个页面和跨页 QA 独立执行 |
| 2026-09-10 19:45 +08:00 | Codex | 完成 M3-007 Data Garden 全站 UI 重构 | Task 1–8 均完成独立实现与复审；全量 182 files/1062 tests、lint/typecheck/integration/build/API smoke/diff check exit 0；`pnpm test:e2e` 在 `workers: 1` 下 2 tests passed，覆盖六导航与 1440/1024/430/390/360 视口；Docker CLI 缺失如实保留；下一步进入 M3-004 MET/运动计算 |
| 2026-09-10 19:55 +08:00 | Codex | 开始 M3-008 饮食分餐快捷添加 | 用户确认增加每餐添加入口；基于 UI_DESIGN_SYSTEM.md §7.2，将四餐快捷按钮接入统一搜索/份量确认状态机；计划先运行 focused RED 测试，再实现、验收并更新交接摘要 |
| 2026-09-10 20:10 +08:00 | Codex | 完成 M3-008 饮食分餐快捷添加 | RED 先失败后 GREEN；四餐摘要增加快捷添加、目标餐次预选、统一搜索框聚焦与响应式 44px 命中区；聚焦 2 files/11 tests、全量 182 files/1063 tests、lint/typecheck/build/diff check、Playwright 2 tests 均 exit 0；下一步进入 M3-004 MET/运动计算准备 |
| 2026-09-10 20:20 +08:00 | Codex | 开始 M1-010 测试期远程食物目录导入 | 用户确认测试阶段直接拉取 `ruoshui6662/china-food-composition-data`；已确认 fixed-en 目录存在 61 个合并 JSON 文件及全量 CSV；计划先补远程目录合并与 checksum 的 RED 测试 |
| 2026-09-10 20:40 +08:00 | Codex | 完成 M1-010 测试期远程食物目录导入 | 新增远程目录合并、checksum、启动前导入脚本与 Compose 配置；兼容上游 `899*` footnote 和 `un` unknown marker；真实 fork 61 files/1677 foods 首次 promoted、二次 already_promoted；全量 183 files/1067 tests、lint/typecheck/build/API smoke/E2E/diff check 通过；下一步进入 M3-004 MET/运动计算准备 |
| 2026-09-10 11:37 +08:00 | Codex | 开始 M1-011 局域网 HTTP 下饮食记录幂等键兼容 | 截图复现为 `crypto.randomUUID is not a function`：`http://192.168.x.x` 非安全上下文使加入记录在 fetch 前失败；先补回归测试并观察 RED，再实现最小回退 |
| 2026-09-10 11:50 +08:00 | Codex | 完成 M1-011 局域网 HTTP 下饮食记录幂等键兼容 | `createIdempotencyKey` 回退已通过 focused/full tests、lint/typecheck/build/API smoke/E2E/diff check；随后与 M3-009 一并提交，飞牛需强制 pull/recreate |

| 2026-09-10 22:40 +08:00 | Codex | 开始 M3-009 今日热量摘要 | 用户确认按设计执行；先补空日与超预算 RED 测试，目标是显示 0 摄入/剩余预算并保持无目标不可用事实边界 |
| 2026-09-10 22:50 +08:00 | Codex | 完成 M3-009 今日热量摘要 | 今日热量卡已完成；单独重跑全量测试通过（183 files/1070 tests），lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0；并行首次全量测试因资源争用超时，未作为验收证据；下一步 M3-004 |
| 2026-09-10 23:05 +08:00 | Codex | 开始 M3-010 今日页体重趋势摘要 | 用户确认开始执行；先补无记录/近期记录 RED 测试，范围固定为今天往前 7 天至今天，复用服务端趋势且不改 API/DB |
| 2026-09-10 23:20 +08:00 | Codex | 完成 M3-010 今日页体重趋势摘要 | 今日页接入可选最近 7 天体重趋势卡；旧记录/无记录完全隐藏，变化值与图表使用真实服务端点；抽取共享 WeightTrendChart，补响应式样式与 14 个 focused tests；全量 183 files/1073 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0；下一步 M3-004 |
| 2026-09-10 23:25 +08:00 | Codex | 开始 M3-011 今日饮食记录功能区 | 用户确认按第一性原理方案执行；复用现有搜索/日记写入链路，先补四餐入口、记录饮食入口和无记录空状态 RED 测试 |
| 2026-09-10 23:45 +08:00 | Codex | 完成 M3-011 今日饮食记录功能区 | 今日页新增完整饮食记录卡、四餐添加按钮、总入口、无记录空状态、目标餐次联动、搜索聚焦和动态提交文案；全量 183 files/1076 tests、lint/typecheck/build/API smoke、Playwright E2E 2 passed、diff check 均 exit 0；下一步 M3-004 |

## 11. 交接摘要

M0 基础代码已完成；M1 10/10 与 M2 6/6 已完成；M1-007 已通过首次设置、登录、搜索、添加、编辑、复制、删除和响应式浏览器门禁；M1-010 已接入测试期远程食物目录 bootstrap（默认用户 fork，可用 `FOOD_DATA_REMOTE_ENABLED=false` 关闭）；M1-011 已修复局域网 HTTP 下饮食记录幂等键兼容；M3-001 决策、M3-002 菜谱计算/API、M3-003 菜谱 UI/E2E、M3-007 全站 UI 重构、M3-008 分餐快捷添加、M3-009 今日热量摘要、M3-010 今日页体重趋势摘要与 M3-011 今日饮食记录功能区已完成。后续接手者应：

1. 开始 M3-004 前先读取运动产品/技术规范，定义运动记录、MET 计算和历史 snapshot 边界；
2. 审阅 `ADR-0002-recipe-snapshot.md`、`docs/superpowers/plans/2026-09-09-recipe-calculation-api.md` 和 `docs/superpowers/plans/2026-09-10-recipe-ui-e2e.md`，保持 ingredient snapshot、显式刷新、cache 失效、recipe-to-diary 与客户端不重算边界；
3. 复用 `overview`、`weight_trend_v1`、`adaptive_tdee_v1`，保持不足数据不估算且不自动改目标；
4. 开始任务前按根目录 `AGENTS.md` 更新本文件，并记录验收命令、退出码和关键结果。

## 12. 更新模板

```markdown
### <TASK-ID> — <任务名>

- 状态：`IN_PROGRESS|BLOCKED|DONE|DESCOPED`
- 开始/更新时间：YYYY-MM-DD HH:mm +08:00
- 操作者：
- 依赖：
- 变更文件：
- 验收命令：
- 结果：
- 阻塞/风险：
- 下一步：
```
