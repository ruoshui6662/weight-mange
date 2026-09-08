# ADR-0001：SQLite 驱动候选与验证门

- 状态：`PROVISIONAL`
- 日期：2026-09-09
- 关联任务：M0-002

## 背景

项目需要 SQLite 的 WAL、foreign keys、busy timeout、FTS5、短事务、可验证备份和多架构 Docker 运行。原方案候选为 Node.js 24 LTS、`node:sqlite` 和 Drizzle，但两者在当前时间点仍存在 RC 依赖风险。

## 当前候选

```text
Node.js 24.19.x/24.20.x
node:sqlite
drizzle-orm 1.0.0-rc.4
drizzle-kit 1.0.0-rc.4
```

TypeScript 暂锁 `6.0.3`，因为当前 `typescript-eslint@8.70.0` 的 peer 范围为 `<6.1.0`；TypeScript 7 会导致 lint 启动失败。

## 已验证行为

`packages/db/test/sqlite-driver.test.ts` 已验证：

- `foreign_keys=ON`；
- `busy_timeout=5000`；
- 事务失败后的显式 rollback；
- SQLite FTS5 建表、写入和检索；
- Drizzle 在同一 `DatabaseSync` 连接上执行 SQL；
- `node:sqlite` backup API 生成可重新打开的备份。

验证结果：6 tests passed；lint、typecheck、integration command、build 和 docker smoke baseline 均 exit 0。

## 已知限制

- `node:sqlite` 当前为 release candidate；
- Drizzle 对应接入文档仍使用 RC 包；
- Vitest 从 workspace 根解析 Drizzle，因此根开发依赖也必须声明同一精确版本；
- pnpm 11 需要在 `pnpm-workspace.yaml` 中显式声明 `allowBuilds: esbuild`；
- 当前尚未完成 migration runner、文件数据库 WAL 专项测试、真实 Docker 镜像和 amd64/arm64 构建。

## 通过条件

只有以下条件全部满足，状态才能改为 `ACCEPTED`：

1. migration 空库/重复执行/失败恢复测试通过；
2. 文件数据库 WAL、`integrity_check` 和并发忙等待测试通过；
3. backup/restore 与 `/data` uploads 的一致性边界通过；
4. Docker runtime 在 linux/amd64、linux/arm64 构建并完成 smoke；
5. 不需要绕过 pnpm/TypeScript/Drizzle 的供应链或模块解析安全策略。

若任一条件失败，评估 `better-sqlite3` 作为同一 Drizzle schema 的备选驱动，并保留本 ADR 的失败证据。
