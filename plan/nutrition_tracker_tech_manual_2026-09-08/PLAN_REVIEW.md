# 开发方案审查与细化建议

> 审查版本：v1.0  
> 审查时间：2026-09-09 06:30 +08:00  
> 审查范围：本目录原有 8 份产品与技术规范  
> 结论：方向正确、领域覆盖较完整，但尚未达到可直接连续实施的精度

## 1. 总体判断

现有方案已经完成了多数早期项目最容易遗漏的设计：本地优先、历史营养快照、食物来源追踪、AI 提案边界、数据库升级保护、响应式设计和降级策略都很明确。

当前主要问题不是“缺一个更复杂的架构”，而是从蓝图到执行之间还缺三层连接：

1. 产品需求、API、数据库和 UI 之间没有逐项追踪关系；
2. 若干已经写入原则的基础能力没有对应数据模型或接口；
3. 路线只有版本功能列表，没有依赖、阶段退出条件和验证证据。

因此不建议推翻现有模块化单体方案。正确做法是保留架构，补齐 contract、前置安全基础，并用纵向切片推进。

## 2. 完整度评分

| 维度 | 评价 | 说明 |
|---|---|---|
| 产品定位与边界 | 良好 | 自用、本地优先、AI 可禁用等边界清晰 |
| 领域架构 | 良好 | 模块边界和依赖方向合理 |
| 营养计算 | 良好 | 确定性、版本化、unknown/trace 处理扎实 |
| 食物数据 | 良好 | 导入、校验、来源和升级链路完整 |
| 数据库可实施性 | 需细化 | 缺会话、幂等、乐观锁、任务锁及部分快照 |
| API 完整性 | 需细化 | 多项 V1 能力没有 endpoint 或 request/response contract |
| UI 覆盖 | 需细化 | 核心 Dashboard 详细，系统管理和异常流程不足 |
| 部署与恢复 | 中上 | 原则正确，但 Dockerfile、原子恢复和安全运行参数不够具体 |
| 测试与验收 | 中上 | 已列测试类型，缺统一命令、fixture 规模和阶段门槛 |
| 执行与交接 | 原先缺失 | 本次通过路线图、进度表和协作规则补齐 |

## 3. 已有方案中应保留的部分

- 模块化单体、单业务容器、SQLite 和 React PWA 的组合符合个人自托管场景。
- 页面不能直接访问数据库，跨模块必须经过 application service/domain contract。
- 历史日记保存营养快照，食物数据更新不能改写历史。
- `known`、`trace`、`unknown`、`estimated` 分离，避免把未知值伪装为 0。
- 食物数据采用 staging → validate → diff → promote，且程序版本与数据集版本分离。
- AI 只做解析、解释和 proposal，最终数值由营养引擎计算，写入必须再次确认。
- migration 前备份、失败拒绝写入、旧镜像不得直接打开新 schema DB。
- 核心功能不依赖外部 AI、OFF 或 USDA，符合 graceful degradation。

## 4. P0：开工前或基础阶段必须解决

| ID | 问题 | 影响 | 处理建议 | 目标 |
|---|---|---|---|---|
| GAP-001 | 原路线把备份、迁移放在 v0.5 | 早期 schema 变化和数据损坏没有恢复基础 | 将 migration runner、pre-migration backup、restore smoke test 前移到 M0 | M0 |
| GAP-002 | 首次设置只有产品描述，没有 bootstrap 状态机 | 无法定义“未初始化、已初始化、维护中”的行为 | 定义一次性初始化流程、密码建立、默认用户/餐次/目标创建及重复提交冲突 | M0 |
| GAP-003 | 使用 session cookie，但数据库没有 session 模型 | 重启、失效、撤销和 CSRF 行为不明确 | 增加 `core_session` 或明确采用签名无状态 session，并写过期/轮换规则 | M0 |
| GAP-004 | API 要求幂等性，但数据库无存储结构 | 手机重试仍可能重复写入 | 增加幂等记录：用户、scope、key、request hash、response、状态、过期时间 | M0 |
| GAP-005 | API 要求 optimistic concurrency，但实体没有 `version` | diary/recipe PATCH 无法可靠返回 409 | 为需要并发控制的实体增加整数版本或明确比较 `updated_at` 的精度与原子 SQL | M1 |
| GAP-006 | scheduler 要求 lock 和防重复，但无 job-run 模型 | 重启或多实例误启动可能重复备份 | 增加 `core_job_run`，以 job key + scheduled date 唯一约束实现幂等 | M0 |
| GAP-007 | FOOD_DATA_SPEC 要求 recipe ingredient snapshot，数据库仅保存名称和用量 | 食物数据更新后菜谱重算来源会漂移 | 增加 recipe ingredient nutrient snapshot，或明确菜谱是动态值；推荐保存计算输入快照并在编辑时刷新 | M3 |
| GAP-008 | 每日聚合要求 entry count、energy coverage、goal snapshot，summary 表未包含 | API 与缓存模型无法满足营养引擎 contract | 补充记录数、coverage JSON/字段、goal snapshot 或声明全部即时计算 | M1 |
| GAP-009 | 驱动组合尚未经过兼容性验证 | `node:sqlite` 与 Drizzle 接入仍存在 RC 风险 | 先做技术门：migration、事务、FTS5、backup、busy timeout、多架构；失败则切 `better-sqlite3` | M0 |
| GAP-010 | Dockerfile 是占位示例 | 无法作为构建依据或验收部署 | 在 M0 给出可执行 multi-stage Dockerfile、non-root 用户、healthcheck 和 graceful shutdown | M0 |
| GAP-011 | restore 同时替换 DB/uploads，但原子性边界不清楚 | 失败可能形成 DB 与图片不一致 | 规定维护锁、解压临时目录、校验、同文件系统 rename、失败恢复顺序和重启策略 | M0 |
| GAP-012 | 外键删除行为、partial unique index、check 约束未写成完整 DDL | 实现者可能得到不同数据语义 | 首个 schema plan 必须给出明确 `ON DELETE`、唯一约束、状态 check 和索引 | M0/M1 |

## 5. P1：相应功能进入开发前解决

| ID | 缺口 | 对齐动作 | 目标 |
|---|---|---|---|
| GAP-101 | 自定义餐次是 V1 必做，但没有 meal-slot CRUD API | 增加列表、创建、编辑排序、停用接口；禁止删除仍被历史引用的餐次 | M1 |
| GAP-102 | 食物别名是 V1 必做，但没有 alias API | 增加 alias CRUD 和唯一/规范化冲突响应 | M1 |
| GAP-103 | 自定义食物和更新接口没有完整 schema | 明确 basis、nutrients、source、校验、override 行为和响应快照 | M1 |
| GAP-104 | “复制菜谱”在产品中必做，但 API 缺失 | 增加 copy endpoint 或在 create contract 中明确定义 `copyFromId` | M3 |
| GAP-105 | 周饮食总结属于 V1，但 API 只定义日分析 | 增加 weekly analysis contract、时间窗、cache key 和数据最小化规则 | M4 |
| GAP-106 | AI provider 没有修改、禁用、删除接口 | 补齐 provider lifecycle 和 ENV 覆盖时的只读行为 | M4 |
| GAP-107 | 设置模块无 API；运动吃回策略没有落库 | 定义 settings contract，并将 `exercise_budget_mode` 版本化/快照化 | M2/M3 |
| GAP-108 | body measurement 有表但无产品验收/API | 决定纳入 M2 或移出 V1；推荐先 `DESCOPED`，仅保留体重 | M0 决策 |
| GAP-109 | 包装标签图片、食物图片在规范出现但缺 schema/API | 统一为受控 upload asset 模型，定义归属、清理和备份规则 | M1/M3 |
| GAP-110 | 初始化、设置、数据导入、备份恢复、诊断页缺 UI 状态规范 | 为每页补空/加载/错误/成功/危险确认和小屏行为 | 对应里程碑 |
| GAP-111 | 性能目标缺测试数据规模与环境 | 固定 1,677、100k 食物及一年日记 fixtures，报告硬件与冷/热缓存 | M1/M2 |
| GAP-112 | SSRF、压缩炸弹、路径穿越等只写原则未写测试 | 在安全测试矩阵加入 URL 解析、DNS/IP、MIME、解压大小和文件名用例 | M0/M4 |
| GAP-113 | PWA 的“offline-capable”容易被误解为可离线写入 | 产品文案明确 V1 是离线 shell/缓存展示，服务端不可达时禁止写入 | M1 |
| GAP-114 | API endpoint 命名与架构示例不一致 | 统一为 `/api/v1/diary/:date/entries`，所有流程图同步 | M1 |

## 6. P2：稳定版前优化，避免首版过度设计

- Dark Mode 保持预留，不进入 v1.0 必过条件。
- 外部 OFF/USDA 接入先提供 adapter contract，不阻塞本地食物库。
- body 围度、OCR 自动建档、完整离线写入队列保持 V1 外。
- domain event 只承担可重建副作用；在真实需要前不引入通用事件框架。
- `food_item.food_type=recipe` 与独立 Recipe 模块的映射可在 M3 决定，不应提前制造双写。
- 拼音/模糊搜索先对 1,677 条真实数据测量，再决定是否引入额外分词依赖。

## 7. 主要跨文档不一致

| 主题 | 文档 A | 文档 B | 统一方向 |
|---|---|---|---|
| 菜谱快照 | `FOOD_DATA_SPEC`：营养来自 ingredient snapshot | `DATABASE_SCHEMA`：ingredient 无营养快照 | 增加可追溯计算输入快照 |
| 备份阶段 | `PRODUCT_SPEC`：v0.5 稳定化 | `ARCHITECTURE/DOCKER`：每次 migration 前必须备份 | 基础备份前移 M0，完整 UI/保留策略放 M5 |
| API 路径 | `ARCHITECTURE` 示例省略日期段 | `API_SPEC` 包含 `/:date/` | 以 `API_SPEC` 为准并同步示例 |
| Offline | 产品原则称 offline-capable | Docker 文档明确不做离线写入 | V1 定义为核心服务不依赖互联网，不等于客户端脱离服务器写入 |
| Body 围度 | DB 预留通用围度表 | PRODUCT V1 仅明确体重 | 默认移出 V1，除非另行确认 |
| 食物类型 | food 表允许 `recipe` | Recipe 独立维护配方和 cache | M3 明确单向投影，避免两套真相 |
| 热量目标变化 | goal 表版本化 | diary_day 仅引用 goal，可删除/变更语义未写 | goal 不硬删除；日记保存必要目标快照 |

## 8. 推荐实施原则

### 8.1 纵向切片优先

M1 不应一次实现“所有后端表再做所有页面”。推荐依次交付：

```text
搜索一个真实食物
 → 查看详情与来源
 → 选择克数
 → 营养引擎计算
 → 写入早餐快照
 → Dashboard 即时更新
 → 重启后记录仍一致
 → 修改食物源后历史仍不变
```

这条链路一旦通过，架构、数据、API、UI 和部署的核心接口都得到验证。

### 8.2 Contract 先行但不过度抽象

- 对外 JSON contract 和 domain input/output 必须先定义并测试。
- repository 只为当前用例建立接口，不预造通用 CRUD 框架。
- 每个任务产出可独立验收的行为，不以“建了目录”作为完成标准。

### 8.3 风险前置

最先验证不可逆或高成本假设：数据库驱动、migration、backup/restore、食物数据 raw 保真、历史 snapshot。AI、动画和 Dark Mode 延后。

## 9. 技术栈时效性核对

- Node.js 24 是当前 LTS 分支，可作为运行时基线：<https://nodejs.org/en/about/previous-releases>
- React 官方当前主版本为 19.2：<https://react.dev/versions>
- Fastify 5 要求 Node.js 20+，与 Node 24 匹配：<https://fastify.dev/docs/latest/Guides/Migration-Guide-V5/>
- `node:sqlite` 当前为 release candidate，且已有原生 backup API：<https://nodejs.org/api/sqlite.html>
- Drizzle 支持 `node:sqlite`，但其官方示例仍使用 RC 包，应先验证再锁定：<https://orm.drizzle.team/docs/sqlite/connect-node-sqlite>

依赖落库时应固定精确版本并由 Renovate/Dependabot 或人工月度更新，不应把文档中的“React 19”“Fastify 5”直接转成不受控的宽泛版本范围。

## 10. 审查结论

方案不需要重构为微服务，也不需要增加 Redis/PostgreSQL。需要的是：

1. 前置 M0 基础与风险验证；
2. 补齐产品—API—DB—UI 的追踪缺口；
3. 把路线改为有入口、出口和证据的阶段；
4. 持续维护进度、问题和决策记录。

执行顺序和阶段验收见 `IMPLEMENTATION_ROADMAP.md`；当前状态和下一步见 `DEVELOPMENT_PROGRESS.md`。

