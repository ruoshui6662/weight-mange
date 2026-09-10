# Task 8 — Data Garden UI acceptance report

时间：2026-09-10 19:45 +08:00
任务：M3-007 Task 8 — Cross-page visual QA, accessibility and handoff

## 结果摘要

跨页 QA 已补齐，并修复了真实的 UI 语义回归：饮食/今日条目恢复“名称 · 份量”的单一可读标签；编辑、删除、份量输入和加入记录恢复稳定的 accessible name/field name；体重页恢复旧流程可识别的输入、添加动作和空状态文案；分析空状态避免重复同名标记。新增 `e2e/ui-regression.spec.ts` 覆盖六导航、1440/1024/430/390/360 视口、无横向溢出、键盘焦点、44px 控件和本地目录空状态。

## TDD / 回归证据

- Diary 语义回归先 RED：`diary-page.test.tsx` 缺少“馒头菜谱（副本） · 100g”、命名编辑/删除按钮和 `edit-amount-*` 字段；修复后 focused 5 tests passed。
- 旧 `dashboard.spec.ts` 首次在新 UI 上失败于 diary 文本、搜索结果 accessible name、加入记录按钮、体重输入/空状态和分析重复状态；均以最小语义兼容修复，未弱化断言。
- 修复后单测试 E2E：`dashboard.spec.ts` 1 passed；独立 `ui-regression.spec.ts` 1 passed，覆盖全部五档视口。
- 全量 Playwright 在 `workers=2` 时出现测试间共享本地服务状态导致 bootstrap race（`ui-regression.spec.ts` exit 1，`dashboard.spec.ts` 同批 1 passed）；已将 `playwright.config.ts` 固定为 `workers: 1`，主线程最终复跑通过。

## 命令证据

| 命令 | 退出码 | 关键结果 |
|---|---:|---|
| `pnpm vitest run apps/web/test/diary-page.test.tsx apps/web/test/today-page.test.tsx apps/web/test/weight-page.test.tsx apps/web/test/analytics-page.test.tsx apps/web/test/ui-shell.test.tsx` | 0 | 5 files / 26 tests passed |
| `pnpm lint` | 0 | 初次发现 `App.tsx` 未使用旧 `ProfilePanel`（exit 1），删除死代码后复跑 exit 0 |
| `pnpm typecheck` | 0 | TypeScript project references passed |
| `pnpm test` | 0 | 182 files / 1062 tests passed |
| `pnpm test:integration` | 0 | 当前无匹配 integration tests，Vitest 明确返回 0 |
| `pnpm build` | 0 | Vite production build + typecheck passed |
| `pnpm api:smoke` | 0 | home/health/ready 均 200 |
| `pnpm test:e2e`（修复后第一次） | 0 | 1 dashboard test passed |
| `pnpm exec playwright test e2e/ui-regression.spec.ts` | 0 | 1 cross-page test passed，5 viewports |
| `pnpm test:e2e`（最终，`workers: 1`） | 0 | 2 tests passed（dashboard + ui regression） |
| `git -c safe.directory='D:/AI编程/体重管理' diff --check` | 0 | 无 whitespace 错误，仅 CRLF 转换提示 |
| `docker --version` / Docker smoke | N/A | 本机 Docker CLI 不可用，未执行本地容器 build/run；需 CI buildx 或 NAS 验证 |

## 覆盖范围与限制

- 导航：今日、饮食、菜谱、体重、分析、我的；每档检查 6 个按钮、`aria-current`、可聚焦和高度不小于 44px。
- 视口：1440×900、1024×768、430×932、390×844、360×800。
- 状态：饮食本地目录空结果可见；页面 focused tests 覆盖 loading/error/empty/insufficient 语义。
- 未改变 API、数据库、计算、快照或数据边界。
- Docker 实测仍受本机缺少 Docker CLI 阻塞；容器 build/run 需由 CI buildx 或 NAS 验证。

## 交接

下一步为 M3-004 MET/运动计算。接手者应先读取运动产品/技术规范；容器 build/run 仍由 CI buildx 或 NAS 完成。
