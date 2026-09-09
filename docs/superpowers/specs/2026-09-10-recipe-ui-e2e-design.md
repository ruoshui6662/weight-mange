# M3-003 菜谱 UI/E2E 设计规格

## 目标

在现有移动端 Dashboard 中建立菜谱的可用闭环：用户可以搜索本地食物、组合原料、填写成品重量和份数，查看确定性营养结果与数据质量提示，显式刷新原料，复制或删除菜谱，并把指定克数加入某一天的日记。加入日记后只依赖 diary nutrition snapshot，后续菜谱或食物变化不得漂移历史记录。

## 范围与非目标

本任务只覆盖 M3-003 的 Web 交互和浏览器验收，不新增数据库迁移、不改变 Recipe/Diary API 的事实边界、不接入外部食品库、不实现运动记录或 AI 建议。

复用现有接口：

- `GET /api/v1/recipes`
- `POST /api/v1/recipes`
- `GET /api/v1/recipes/:id`
- `PATCH /api/v1/recipes/:id`
- `POST /api/v1/recipes/:id/copy`
- `POST /api/v1/recipes/:id/refresh-ingredients`
- `DELETE /api/v1/recipes/:id`
- `POST /api/v1/recipes/:id/add-to-diary`
- `GET /api/v1/foods/search`

## 用户流程

1. 用户从主导航进入“菜谱”，看到未软删除菜谱列表和“新建菜谱”。
2. 新建表单要求菜谱名称和至少一个原料；原料行通过本地食物搜索选择 `foodId`，再填写克数。单位首版固定为 `g`，避免 UI 在无 serving 选择器时产生错误输入。
3. 用户可选填写成品重量和份数。只填写成品重量时展示每 100g；只填写份数时展示每份；两者都填写时同时展示；未填写时只展示总营养并显示对应 warning。
4. 保存成功后进入详情视图，展示原料快照、总营养、每 100g/每份营养、coverage 和 trace/estimated/unknown 状态。
5. 详情视图提供“编辑”“复制”“刷新原料”“删除”和“加入日记”。刷新是显式操作，并展示服务端 warnings；不会静默覆盖用户看到的快照。
6. 加入日记要求日期、餐次和克数，首版单位固定为 `g`；成功后回到当前日记并显示菜谱记录。客户端刷新日记后，历史营养来自 diary snapshot。

## 页面与状态设计

### 导航

在 `DashboardTab` 增加 ready 状态的 `recipe` 项，底部导航改为六列。所有按钮保持至少 44px 高度；360px 宽度下不得产生横向溢出。菜谱页不影响现有今日、饮食、体重、分析和我的页面。

### 菜谱列表状态

- `loading`：显示“正在加载菜谱…”并禁用重复操作。
- `empty`：说明尚未保存菜谱，提供“新建菜谱”。
- `ready`：按 API 返回顺序展示名称、成品重量/份数摘要、warning 数量和更新时间（如果 API 未提供更新时间则不伪造时间，显示计算版本）。
- `error`：显示可读错误和“重试”，不清空已有列表。

### 编辑器状态

编辑器维护本地草稿，不在每次输入时请求服务端。原料搜索结果属于当前行；选择结果后保存 `foodId` 和名称展示值，服务端仍以 `foodId` 为事实来源。提交前校验名称非空、原料数量至少 1、每行用量为正数、成品重量和份数（若填写）为正数。

保存、编辑和刷新期间显示忙碌状态，成功后以服务端返回的 recipe 重新渲染。`409 RECIPE_VERSION_CONFLICT` 显示“菜谱已被更新，请重新加载后再编辑”，不自动覆盖用户草稿。

### 计算结果

营养卡片对每个 nutrient 展示 amount；coverage 小于 1、`hasTrace`、`hasEstimated` 或 unknown warning 使用文字标签和颜色组合表达，不能只依赖颜色。缺少成品重量或份数时展示服务端 warnings，不将 null 结果格式化为 0。

### 破坏性操作

删除前使用原生确认对话框，取消不发请求；删除成功后回到列表并移除该菜谱。复制成功后进入副本详情，副本必须是独立 snapshot。刷新原料必须是明确按钮，成功后展示 warnings 和新结果。

## 数据流与事实边界

```text
food search
   ↓ foodId + amount
recipe editor ── POST/PATCH ──> recipe snapshot + cache
   ↓ detail response
nutrition result + warnings
   ↓ add-to-diary(date, meal, grams)
diary snapshot ── GET diary ──> historical entry
```

客户端只负责输入、展示和请求编排；营养计算、food revision、snapshot、cache 失效、版本冲突和历史稳定性全部由服务端负责。客户端不根据当前 food 重新计算，不把 warning 转换成成功数值，不以列表缓存替代详情响应。

## 错误与离线行为

- `RECIPE_NOT_FOUND`、`RECIPE_FOOD_NOT_FOUND`、`RECIPE_INGREDIENT_NOT_FOUND`：显示资源不可用并提供返回列表。
- `RECIPE_VERSION_CONFLICT`：保留当前草稿，提示重新加载。
- `RECIPE_COOKED_WEIGHT_REQUIRED`、日期/餐次/金额校验错误：显示字段或操作级提示。
- 网络错误：显示“请求未完成，请检查服务状态后重试”，保留页面已有数据和草稿。
- 无本地食物搜索结果：显示现有本地目录导入说明，不访问外部网络。

## 测试与验收

### Web 单元/交互测试

- 导航包含“菜谱”，六项按钮均可观察当前状态，且旧页面仍可渲染。
- 菜谱列表的 loading/empty/error/ready 状态可见。
- 编辑器拒绝空名称、空原料和非正数，展示 warning 文案而不是伪造 0。
- recipe API client 正确编码 id、携带 credentials、发送 refresh/copy/delete/add-to-diary 请求。

### Playwright E2E

在临时 SQLite 和受控本地食物种子上验证：首次设置或登录→进入菜谱→搜索并选择食物→创建带成品重量和份数的菜谱→看到 total/per100g/perServing→看到 warning（无成品重量的第二个场景）→复制→编辑→显式刷新→加入日记→回到饮食页看到菜谱记录→通过 API 修改 recipe 后日记营养仍保持原快照。测试覆盖 360/390/430px 无横向溢出和 44px 命中区。

完整门禁：`pnpm lint`、`pnpm typecheck`、`pnpm test`、`pnpm test:integration`、`pnpm build`、`pnpm api:smoke`、`pnpm test:e2e`、`git -c safe.directory='D:/AI编程/体重管理' diff --check`。

## 设计决策

1. 菜谱作为第六个主导航项，而不是藏在“我的”页面：核心任务是频繁记录和复用，一级入口降低发现成本；六列布局在目标 viewport 仍能满足命中区要求。
2. UI 首版只提交 `g`：API 已支持 `ml/serving`，但 serving 选择需要额外的食物详情交互；先保证克数路径正确，后续单独扩展单位选择器。
3. warning 使用服务端原始语义展示：客户端不自行推断 coverage 或缺失原因，保持 `ADR-0002` 的 snapshot 与可追溯边界。
4. 加入日记后立即刷新日记视图：用户需要看到事实已经落库，同时通过已有 diary snapshot 保证后续更新不漂移。
