# 开发进度实时记录

> 这是项目状态的单一事实源。  
> 更新模式：事件驱动——任务开始、阻塞、恢复、完成和交接时立即更新。  
> 项目时区：Asia/Shanghai（UTC+08:00）  
> 最后更新：2026-09-09 18:37 +08:00

## 1. 当前快照

| 项目 | 当前值 |
|---|---|
| 项目阶段 | M1 饮食记录纵向切片实施 |
| 总体状态 | `IN_PROGRESS` |
| 当前里程碑 | M1 — 饮食记录纵向切片 |
| 当前焦点 | M1-003 Food import staging pipeline review |
| 下一步 | 复审离线 importer 的 raw JSON contract、staging failure isolation、promote rollback 与 FTS rebuild；通过后进入 M1-004 Food search/detail API |
| 当前阻塞 | 无；M1-002 已完成并通过复审 |
| 业务代码 | M1-001 Nutrition Engine 基础与 M1-002 Food canonical schema 已完成 |
| Git | 远程 `main` 已包含 M1-001；根路径镜像仍可用 `cc60f7c62750202ef36d8601b67ee1e6b41dfaec` |

> “实时”表示每次状态事件即时写入本文件，不表示后台定时器自动采集。后续接手者应先读本页，再执行任何任务。

## 2. 里程碑概览

| 里程碑 | 目标 | 状态 | 完成任务 | 退出门槛 |
|---|---|---:|---:|---|
| DOC | 审查方案并建立可交接路线 | `DONE` | 2/2 | 新增文档可读、互链、结构与任务统计检查通过 |
| M0 | 可验证基础 | `DONE` | 7/7 | 初始化、鉴权、迁移、备份恢复、容器 smoke 与多架构构建全部通过 |
| M1 | 饮食记录纵向切片 | `IN_PROGRESS` | 2/8 | 离线于公网完成真实食物记录闭环 |
| M2 | 目标、体重与基础分析 | `PLANNED` | 0/6 | 趋势/TDEE 确定性且历史目标不漂移 |
| M3 | 菜谱、运动与预算策略 | `PLANNED` | 0/6 | 菜谱/运动快照和预算策略通过 |
| M4 | 可选 AI | `PLANNED` | 0/6 | AI 失败不影响核心，写入始终需确认 |
| M5 | 稳定化与 v1.0 发布 | `PLANNED` | 0/8 | 安装、升级、回滚、恢复和多架构发布演练通过 |

## 3. 当前任务

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

- 状态：`IN_PROGRESS`
- 开始时间：2026-09-09 18:25 +08:00
- 完成时间：未完成
- 操作者：Codex + delegated implementer
- 依赖：M1-002
- 计划变更：实现受控 raw JSON 导入、staging 写入、结构/语义校验、规范化、active diff、事务 promote 与可审计报告；失败不得改变 active catalog
- 计划验收：TDD RED/GREEN；20–50 个 golden foods 覆盖 code、macro、raw、alias、serving；重复版本幂等；失败隔离；promote 回滚；全量 lint/typecheck/test/integration/build/API smoke/docker smoke
- 当前进展：已修复独立复审的 4 项 Important 问题：`kJ` unit/source remark、结构失败 staging 审计、无穷/非法数值拒绝；已完成回归与全量门禁，待复审确认
- 阻塞/风险：真实外部 CFCD 数据不随仓库引入；使用受控 golden fixtures 验证 importer contract
- 下一步：先固定 importer 输入/输出 contract 和 staging 事务测试

## 4. DOC 任务板

| ID | 任务 | 状态 | 负责人 | 证据/备注 |
|---|---|---|---|---|
| DOC-001 | 通读并交叉审查原有 8 份开发文档 | `DONE` | Codex | 审查范围及结论见 `PLAN_REVIEW.md` |
| DOC-002 | 建立 README、审查报告、路线图、进度记录和 AGENTS 规则 | `DONE` | Codex | EVD-DOC-002 |
| DOC-003 | 确认 P0 决策并同步修订原始规范（后续，不计入本次 DOC 基线） | `PLANNED` | 未分配 | 应在开始业务代码前处理 GAP-002/003/007/008/009 |

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

## 7. 决策记录

| 决策 ID | 状态 | 决策 | 理由 | 日期 |
|---|---|---|---|---|
| DEC-001 | `ACCEPTED` | 保留模块化单体、单业务容器和 SQLite | 与个人自托管规模匹配，运维成本最低 | 2026-09-09 |
| DEC-002 | `ACCEPTED` | 迁移、最小备份恢复和鉴权前移到 M0 | 它们是安全迭代的基础，不应等到稳定化阶段 | 2026-09-09 |
| DEC-003 | `ACCEPTED` | V1 offline 定义为“不依赖公网”，不支持客户端脱离服务器写入 | 避免首版引入同步与冲突合并复杂度 | 2026-09-09 |
| DEC-004 | `ACCEPTED` | V1 锁定 `node:sqlite + Drizzle` | 本地 migration/WAL/FTS5/backup/transaction 门禁通过，GitHub Actions 多架构 Docker buildx 通过；RC 风险保留在 ADR 的升级检查中 | 2026-09-09 |
| DEC-005 | `PROPOSED` | V1 暂不实现围度管理 | 产品验收未要求，避免无 UI/API 的幽灵功能 | 2026-09-09 |
| DEC-006 | `PROPOSED` | 菜谱保存 ingredient 计算输入快照，编辑时刷新 | 保持来源可追溯，同时让日记历史永不漂移 | 2026-09-09 |
| DEC-007 | `ACCEPTED` | V1 使用有状态数据库 session；token 只以 SHA-256 保存，cookie 默认 HttpOnly/SameSite=Lax | 支持撤销、过期和重启后的明确会话状态；避免无状态 token 无法即时失效 | 2026-09-09 |
| DEC-008 | `ACCEPTED` | canonical nutrient unit 增加 `kJ`，`energy_kj` 必须以 `kJ` 持久化 | `FOOD_DATA_SPEC.md` 与 `DATABASE_SCHEMA.md` 已定义 energyKJ/energy_kj，但原 schema 的单位 CHECK 漏列 kJ；错误标为 kcal 会污染导入数据 | 2026-09-09 |

`PROPOSED` 决策不能作为最终 contract。进入受影响任务前，必须改为 `ACCEPTED`、`REJECTED` 或 `SUPERSEDED`，并同步相关规范。

## 8. 验收证据

| Evidence ID | 任务 | 时间 | 命令/检查 | 结果 |
|---|---|---|---|---|
| EVD-DOC-001 | DOC-001 | 2026-09-09 06:30 +08:00 | 原始文档清单、标题和交叉需求检查 | 8/8 已审查；缺口登记于 `PLAN_REVIEW.md` |
| EVD-DOC-002 | DOC-002 | 2026-09-09 06:38 +08:00 | PowerShell：文件存在/非空、README 本地链接、H1、原始文档存在、路线任务数 | exit 0；新增 5/5，原始 8/8，链接全部解析，M0–M5 任务数 7/8/6/6/6/8 |
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
| EVD-M1-003-A | M1-003 | 2026-09-09 18:28 +08:00 | `pnpm vitest run tools/food-import/test/food-import.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke` | 聚焦 1 file/5 tests、全量 13 files/59 tests，lint/typecheck/build/API smoke 均 exit 0；docker smoke 正确报告 Docker CLI 缺失；实现待独立复审 |
| EVD-M1-003-B | M1-003 | 2026-09-09 18:37 +08:00 | `pnpm vitest run tools/food-import/test/food-import.test.ts`; `pnpm vitest run packages/db/test/food-schema.test.ts`; `pnpm lint`; `pnpm typecheck`; `pnpm test`; `pnpm test:integration`; `pnpm build`; `pnpm api:smoke`; `pnpm docker:smoke` | 审查修复聚焦 7 importer tests、8 schema tests；全量 13 files/63 tests；lint/typecheck/build/API smoke 均 exit 0；docker smoke 正确报告 Docker CLI 缺失；等待复审确认 |

后续代码证据应记录具体命令、退出码和关键计数，例如：

```text
pnpm test --filter nutrition-engine
exit: 0
result: 42 passed, 0 failed
```

“已检查”“看起来正常”或只给文件路径不能作为通过证据。

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

## 11. 交接摘要

M0 基础代码已完成；飞牛启动修复已通过远程多架构构建并发布。后续接手者应：

1. 先确认 DOC-002 已完成验证；
2. 与项目所有者确认 DEC-004/005/006 和 session 方案；
3. 执行 DOC-003，同步修订原始规范；
4. 先执行 M1-001 的规范读取和 golden test；
5. 开始任务前按根目录 `AGENTS.md` 更新本文件。

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
