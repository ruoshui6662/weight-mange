# 营养与体重管理项目开发文档索引

> 文档集版本：v1.1  
> 基线日期：2026-09-08  
> 当前状态：规划细化阶段，业务代码尚未开始  
> 项目定位：个人自用、自托管、Docker 化的饮食/体重/运动/减脂管理应用

## 1. 建议阅读顺序

1. [PRODUCT_SPEC.md](./PRODUCT_SPEC.md)：产品目标、V1 边界、核心流程和成功指标。
2. [PLAN_REVIEW.md](./PLAN_REVIEW.md)：现有方案审查结论、冲突、缺口与处理优先级。
3. [IMPLEMENTATION_ROADMAP.md](./IMPLEMENTATION_ROADMAP.md)：实际开发顺序、依赖、阶段门槛和验收证据。
4. [DEVELOPMENT_PROGRESS.md](./DEVELOPMENT_PROGRESS.md)：当前进度、阻塞、下一步、决策和交接记录。
5. [ARCHITECTURE.md](./ARCHITECTURE.md)：总体架构、模块边界、数据流与测试架构。
6. [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)：持久化模型、快照和一致性约束。
7. [API_SPEC.md](./API_SPEC.md)：HTTP contract、安全、并发与错误结构。
8. [NUTRITION_ENGINE_SPEC.md](./NUTRITION_ENGINE_SPEC.md)：确定性营养计算规则。
9. [FOOD_DATA_SPEC.md](./FOOD_DATA_SPEC.md)：食物数据导入、标准化、搜索与来源追踪。
10. [UI_DESIGN_SYSTEM.md](./UI_DESIGN_SYSTEM.md)：视觉、交互、响应式和无障碍规范。
11. [DOCKER_DEPLOYMENT.md](./DOCKER_DEPLOYMENT.md)：部署、升级、备份、恢复和运维。

## 2. 文档职责与优先级

当文档出现冲突时，按以下顺序处理：

1. 已接受且未被替代的决策记录；
2. `PRODUCT_SPEC.md` 中的产品边界和验收标准；
3. 对应领域规范中的明确 contract；
4. `IMPLEMENTATION_ROADMAP.md` 中的阶段顺序；
5. 示例代码、示意结构和推荐值。

发现冲突时不能自行选择一个版本并静默实现。应在 `DEVELOPMENT_PROGRESS.md` 的问题队列中登记，形成决策后再同步修改所有受影响文档。

## 3. 当前开发路线

```text
M0 可验证基础
 ↓
M1 可用的饮食记录纵向切片
 ↓
M2 体重、目标与基础分析
 ↓
M3 菜谱、运动与预算策略
 ↓
M4 可选 AI 提案与分析
 ↓
M5 稳定化、PWA 与发布
 ↓
v1.0 自用稳定版
```

与原版本路线相比，备份、迁移、鉴权、幂等性和基础诊断已前移到 M0/M1。这些能力是后续安全迭代的地基，不再等到 v0.5 才补。

## 4. 阶段门槛

每个里程碑只有在以下条件全部满足后才能关闭：

- 范围内任务均为 `DONE` 或有明确 `DESCOPED` 决策；
- 该阶段定义的 lint、typecheck、测试和构建命令退出码均为 0；
- 数据迁移、营养计算等高风险路径保存了专项验证证据；
- 受影响的产品、API、数据库和部署规范已同步；
- `DEVELOPMENT_PROGRESS.md` 已更新，并给出下一阶段第一项动作。

## 5. 进度记录约定

- 当前状态只看 `DEVELOPMENT_PROGRESS.md`，不要从任务聊天推断。
- 每次开始、阻塞、恢复、完成或移交任务都要更新进度文件。
- “完成”必须附验收命令及结果；只有文件存在或代码已编写不算完成。
- 活动日志采用追加式记录；顶部快照保持精简并随状态变化覆盖更新。
- 任务状态、时间格式和敏感信息规则见仓库根目录 `AGENTS.md`。

## 6. 尚未解决的关键决策

当前最先需要验证的是 SQLite 技术组合：

- 候选 A：Node.js 24 LTS + `node:sqlite` + Drizzle；
- 备选 B：Node.js 24 LTS + `better-sqlite3` + Drizzle。

`node:sqlite` 当前为 release candidate，Drizzle 的对应接入文档仍使用 RC 包。因此 M0 必须先验证 migration、事务、FTS5、backup API、并发忙等待及 amd64/arm64 构建；未通过前不得锁定驱动。

