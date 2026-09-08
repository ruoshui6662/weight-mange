# 开发进度实时记录

> 这是项目状态的单一事实源。  
> 更新模式：事件驱动——任务开始、阻塞、恢复、完成和交接时立即更新。  
> 项目时区：Asia/Shanghai（UTC+08:00）  
> 最后更新：2026-09-09 07:20 +08:00

## 1. 当前快照

| 项目 | 当前值 |
|---|---|
| 项目阶段 | M0 可验证基础实施 |
| 总体状态 | `IN_PROGRESS` |
| 当前里程碑 | M0 — 可验证基础 |
| 当前焦点 | M0-005 Backup/restore 最小闭环 |
| 下一步 | 在 schema 基线上补可校验的备份 manifest、完整性检查与原子恢复测试 |
| 当前阻塞 | BLK-005：Docker CLI 未安装，M0-002 的多架构验证暂缓 |
| 业务代码 | 尚未开始 |
| Git | 已初始化 `main`；基线提交 `6ae1c95`；全局提交身份未配置，提交使用一次性 `Codex <codex@local>` 身份 |

> “实时”表示每次状态事件即时写入本文件，不表示后台定时器自动采集。后续接手者应先读本页，再执行任何任务。

## 2. 里程碑概览

| 里程碑 | 目标 | 状态 | 完成任务 | 退出门槛 |
|---|---|---:|---:|---|
| DOC | 审查方案并建立可交接路线 | `DONE` | 2/2 | 新增文档可读、互链、结构与任务统计检查通过 |
| M0 | 可验证基础 | `IN_PROGRESS` | 3/7 | 初始化、鉴权、迁移、备份恢复、容器 smoke 全部通过 |
| M1 | 饮食记录纵向切片 | `PLANNED` | 0/8 | 离线于公网完成真实食物记录闭环 |
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

- 状态：`IN_PROGRESS`
- 开始时间：2026-09-09 07:20 +08:00
- 操作者：Codex
- 依赖：M0-004
- 计划变更：实现 SQLite 在线备份、manifest/checksum 校验和安全恢复入口
- 计划验收：备份可重开、manifest 可验证、损坏备份拒绝恢复、恢复失败不覆盖现有数据库
- 当前进展：任务已启动，尚未写入失败测试
- 下一步：先写备份 manifest 与损坏文件拒绝恢复测试

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
| M0-002 | SQLite/ORM 技术门 | `BLOCKED` | M0-001 | EVD-M0-002-A/B/C；候选未最终接受，等待 Docker |
| M0-003 | Core contracts | `DONE` | M0-001 | EVD-M0-003-A |
| M0-004 | Schema 与 migration 基线 | `DONE` | M0-002/003 | EVD-M0-004-A |
| M0-005 | Backup/restore 最小闭环 | `PLANNED` | M0-004 | restore + corruption/rollback tests |
| M0-006 | 首次初始化与鉴权 | `PLANNED` | M0-003/004 | bootstrap once + auth/security tests |
| M0-007 | 可执行容器与 CI | `PLANNED` | M0-004/005/006 | Docker smoke + graceful shutdown |

M1–M5 的完整任务和退出门槛见 `IMPLEMENTATION_ROADMAP.md`。只有当前里程碑进入实施时，才把其任务复制到本页活动任务板，避免顶部状态被远期细节淹没。

## 6. 阻塞项

当前有一个环境阻塞。以下决策会阻塞对应任务，但不阻止已可独立验证的本地工作：

| Blocker | 影响任务 | 解除条件 | 状态 |
|---|---|---|---|
| BLK-001 SQLite 驱动未锁定 | M0-004 及后续 DB 工作 | 完成 M0-002 技术门并接受 ADR | `OPEN` |
| BLK-002 Auth session 方案未确定 | M0-004/M0-006 | 在有状态 DB session 与签名无状态 session 中定案 | `OPEN` |
| BLK-003 Recipe snapshot 语义未落库 | M3-001 | 接受 ingredient 计算输入快照设计并修订 schema | `OPEN` |
| BLK-004 工作区隔离方式待确认 | M0-001 后半段及后续实现 | 已创建 `.worktrees/m0-foundation` 和 `feat/m0-foundation` | `RESOLVED` |
| BLK-005 Docker CLI 未安装 | M0-002 完整技术门、M0-007 | 安装 Docker Desktop/Buildx，或在具备 Docker 的 CI/主机运行多架构 smoke | `OPEN` |

## 7. 决策记录

| 决策 ID | 状态 | 决策 | 理由 | 日期 |
|---|---|---|---|---|
| DEC-001 | `ACCEPTED` | 保留模块化单体、单业务容器和 SQLite | 与个人自托管规模匹配，运维成本最低 | 2026-09-09 |
| DEC-002 | `ACCEPTED` | 迁移、最小备份恢复和鉴权前移到 M0 | 它们是安全迭代的基础，不应等到稳定化阶段 | 2026-09-09 |
| DEC-003 | `ACCEPTED` | V1 offline 定义为“不依赖公网”，不支持客户端脱离服务器写入 | 避免首版引入同步与冲突合并复杂度 | 2026-09-09 |
| DEC-004 | `PROPOSED` | `node:sqlite + Drizzle` 仅作为候选，通过技术门后锁定 | 两者对应能力/接入仍存在 RC 风险 | 2026-09-09 |
| DEC-005 | `PROPOSED` | V1 暂不实现围度管理 | 产品验收未要求，避免无 UI/API 的幽灵功能 | 2026-09-09 |
| DEC-006 | `PROPOSED` | 菜谱保存 ingredient 计算输入快照，编辑时刷新 | 保持来源可追溯，同时让日记历史永不漂移 | 2026-09-09 |

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

## 11. 交接摘要

当前仍处于规划阶段，没有业务代码、数据库或容器需要接管。后续接手者应：

1. 先确认 DOC-002 已完成验证；
2. 与项目所有者确认 DEC-004/005/006 和 session 方案；
3. 执行 DOC-003，同步修订原始规范；
4. 获得明确开发指令后再开始 M0-001，不要自行初始化 Git；
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
