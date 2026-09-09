# 导航交互与食物搜索空状态实施计划

> 目标：完成 ISSUE-116，消除 Dashboard “按钮无响应”和“空搜索无反馈”两类不可观察状态。
> 依赖：现有 M1-007 Web UI、M1-004 Food search API、M1-008 集成 golden flow。

## 任务 1：建立可测试的导航状态模型

1. 在 `apps/web/src/flow.ts` 增加 `DashboardTab` 类型及导航文案/能力映射。
2. 用测试先固定五个 tab 的稳定 key、中文标签和 M2 占位能力。
3. 保证未知状态回退到 `today`，避免刷新或未来扩展造成空白页面。

验收：导航模型测试先失败后通过；不改变登录/首次设置流程。

## 任务 2：实现 Dashboard 页面切换

1. 在 `apps/web/src/App.tsx` 为 Dashboard 保存当前 tab。
2. 将底部按钮绑定到状态切换，当前项包含 `aria-current` 和 active 样式。
3. 抽出 `DashboardHome`、`DiaryView`、`ProfileView` 和 `ComingSoonView`，复用既有记账、退出登录和 API 能力。
4. 对体重/分析显示明确的 M2 占位说明，不调用不存在的 API。

验收：组件/行为测试确认点击五个按钮都改变可见内容或占位状态；退出登录仍可用。

## 任务 3：实现搜索反馈状态

1. 为搜索增加 `idle/loading/success/empty/error` 状态，提交新查询时清空旧结果并显示加载反馈。
2. `success` 展示现有食物结果；`empty` 展示本地目录为空或当前查询无匹配的解释。
3. 空状态提供“查看导入说明”交互，打开同页说明面板，指向仓库中的受控 CLI 导入流程。
4. 错误状态沿用统一错误文案，并允许再次搜索。

验收：空结果、请求失败和成功结果测试通过；不增加外部网络请求。

## 任务 4：回归验证与进度记录

1. 运行聚焦 Web 测试，再运行全量 `pnpm test`、`pnpm lint`、`pnpm build`、`pnpm api:smoke`、`git diff --check`。
2. 若环境仍无 Docker CLI，只记录为环境限制，不宣称 Docker 实测通过。
3. 将 `M1-009` 标记为 `DONE`（仅在验收证据完整后），关闭 `ISSUE-116`，更新 M1 统计、当前焦点、下一步、活动日志和交接摘要。

## 实施顺序

任务 1 → 任务 2 → 任务 3 → 任务 4。每一步先测试后实现，避免把导航和搜索空状态耦合到业务 API 变更。
