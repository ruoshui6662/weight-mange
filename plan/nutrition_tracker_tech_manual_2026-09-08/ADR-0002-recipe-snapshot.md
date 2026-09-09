# ADR-0002：菜谱原料营养快照与单向食物投影

- 状态：`ACCEPTED`
- 日期：2026-09-10
- 范围：M3-001 至 M3-003

## 背景

菜谱需要引用本地食物、按原料重量计算总营养，并支持成品重量和份数。食物目录会导入新版本、停用记录或修正营养值；这些变化不能回写已经保存的菜谱计算结果，也不能改变已经写入日记的历史快照。

## 决策

1. 每个 `recipe_ingredient` 在创建或显式刷新时，从当前 active food 解析份量并保存独立的营养输入快照；快照至少包含名称、来源标识、原料克数、营养值/状态、来源基础和 `nutrition_engine_version`。
2. `food_id` 只作为可选来源投影，用于展示来源和发起显式刷新；recipe 不反向写入或修改 food 表。food 停用、改名或营养修订不会自动改变现有 recipe ingredient snapshot。
3. 编辑菜谱原料、重量、份数或执行显式“刷新原料”时，在一个事务内替换受影响的 ingredient snapshot，并使 `recipe_nutrient_cache` 失效。cache 是派生数据，不是唯一事实；读取时允许懒重算。
4. V1 不自动监听 food dataset 变化、不后台批量重算 recipe、不应用 nutrient retention factor。算法版本固定为 `recipe_yield_v1`，计算仍遵循“原料营养求和 + cooked yield”。
5. 将菜谱加入日记时，只通过 application service 生成 diary nutrition snapshot；后续 recipe 或 food 变化不漂移该日记记录。删除菜谱采用 soft delete，只要存在历史引用就保留快照与审计边界。
6. ingredient 无法从当前 food 解析时，保留已有 snapshot 并返回可操作 warning；禁止静默使用新数据或把未知值变成 0。新建或替换原料若无有效 snapshot 则拒绝保存。

## 影响

- 数据库需要 recipe ingredient nutrient snapshot 子表或等价不可变字段、recipe cache 的失效标记/版本和 recipe optimistic version。
- API 需要区分“编辑原料”和“显式刷新原料”，返回 warnings、`recipe_calc_version` 和计算来源；不得把 food projection 当作 recipe 真值。
- UI 必须展示来源、快照时间/版本、unknown/trace/estimated 状态和刷新 warning，并让用户确认刷新。
- M3-002 负责 schema/domain/API 实现，M3-003 负责编辑、刷新、warnings 和历史快照 E2E；本 ADR 不提前实现这些功能。

## 拒绝的方案

- **实时 join food 表重算**：实现简单，但会让食物目录更新静默改变菜谱和历史解释。
- **只保存 food_id 与重量**：无法在食物停用或来源修订后重建原始计算输入，也无法解释历史结果。
- **每次保存都自动刷新所有引用**：会引入不可预测的批量写入、性能和用户确认问题，超出个人自托管 V1 范围。

## 验收边界

- 同一原料快照在 food 改名、停用、营养修订后保持不变。
- 显式刷新只影响当前 recipe，并使 cache 重新计算；既有 diary snapshot 不变。
- cooked weight/serving count 的计算使用固定 `recipe_yield_v1`，总营养、每 100g、每份结果确定。
- snapshot 缺失或状态 unknown/trace/estimated 时有 warning 和 coverage，不伪造数值。
