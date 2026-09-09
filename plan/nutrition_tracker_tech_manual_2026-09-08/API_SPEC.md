<!--
文档版本：v1.0
日期：2026-09-08
项目定位：个人自用、自托管 Docker 饮食/体重/运动/减脂管理应用
设计原则：Local-first / Single-user-first / Modular Monolith / Data Traceability / AI as Assistant
-->

# API_SPEC.md

## 1. API 原则

所有业务 API 前缀：

```text
/api/v1
```

API 采用 JSON，上传图片/备份使用 multipart。

核心规则：

1. 路由层不直接写 SQL；
2. API request/response 都有 schema；
3. 错误结构统一；
4. 任何修改型操作需要幂等性或显式冲突处理；
5. AI 只产生 proposal，确认后才调用业务写入 API；
6. 前端不得依赖数据库内部字段；
7. API version 与 database schema version 分离。

---

## 2. 通用响应

成功：

```json
{
  "data": {}
}
```

列表：

```json
{
  "data": [],
  "meta": {
    "nextCursor": null
  }
}
```

错误：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "输入参数不正确",
    "details": {},
    "requestId": "0199..."
  }
}
```

---

# 3. System

## GET /api/v1/system/health

返回：

```json
{
  "data": {
    "status": "ok",
    "version": "0.4.0",
    "schemaVersion": "20260908_001",
    "database": "ok"
  }
}
```

不暴露 secret。

## GET /api/v1/system/diagnostics

返回：
- appVersion
- schemaVersion
- foodDataset
- dbSize
- walSize
- uploadsSize
- lastBackup
- aiConfigured
- externalProviders

## POST /api/v1/system/reindex-food-search

手动重建搜索索引。

---

# 4. Auth

## GET /api/v1/auth/status

公开接口，用于决定首次设置或登录页面：

```json
{ "data": { "initialized": false } }
```

## POST /api/v1/auth/bootstrap

仅在 `initialized=false` 时可用；成功一次性创建用户并设置 session cookie：

```json
{
  "displayName": "User",
  "password": "至少 12 个字符",
  "timezone": "Asia/Shanghai"
}
```

成功返回 `201` 与 `{ "data": { "user": { ... } } }`。重复调用返回 `409 AUTH_BOOTSTRAP_ALREADY_COMPLETED`。

## POST /api/v1/auth/login

```json
{
  "password": "..."
}
```

成功设置 HttpOnly cookie。

## GET /api/v1/auth/session

无 cookie 或 cookie 已失效时仍返回 `200`：

```json
{ "data": { "authenticated": false, "user": null } }
```

有效 session 返回 `authenticated: true` 及当前 profile。

## POST /api/v1/auth/logout

---

# 5. Profile

## GET /api/v1/profile

## PATCH /api/v1/profile

```json
{
  "displayName": "User",
  "timezone": "Asia/Shanghai",
  "heightCm": 166,
  "birthDate": "1998-01-01",
  "sexForFormula": "male",
  "activityLevel": "light"
}
```

## GET /api/v1/profile/goals

## POST /api/v1/profile/goals

```json
{
  "goalType": "maintain",
  "calorieTargetKcal": 1934,
  "proteinTargetG": 77,
  "fatTargetG": 60,
  "carbTargetG": 271,
  "effectiveFrom": "2026-09-08",
  "source": "manual"
}
```

旧 goal 自动 effective_to。

## POST /api/v1/profile/goals/estimate

仅计算、不写入目标版本。默认使用 Mifflin–St Jeor 与活动系数；用户提供
`manualCalorieTargetKcal` 时优先返回手动目标，可不提供公式输入。

公式估算请求：

```json
{
  "sex": "male",
  "weightKg": 70,
  "heightCm": 175,
  "ageYears": 30,
  "activityLevel": "moderate",
  "adjustmentKcal": -300
}
```

响应：

```json
{
  "data": {
    "source": "formula",
    "estimatedBmr": 1648.75,
    "estimatedTdee": 2555.5625,
    "calorieTargetKcal": 2255.5625
  }
}
```

`adjustmentKcal` 与 `adjustmentPercent` 最多提供一个；输入非法返回
`PROFILE_INVALID_INPUT`。该接口不创建 goal，实际写入仍使用
`POST /api/v1/profile/goals`，以保留有效期和历史快照边界。

---

# 6. Dashboard

## GET /api/v1/dashboard/:date

示例：

```json
{
  "data": {
    "date": "2026-09-08",
    "goal": {
      "kcal": 1934,
      "proteinG": 77,
      "fatG": 60,
      "carbG": 271
    },
    "intake": {
      "kcal": 389,
      "proteinG": 14,
      "fatG": 10,
      "carbG": 62
    },
    "exercise": {
      "burnKcal": 0,
      "creditKcal": 0
    },
    "remainingKcal": 1545,
    "meals": []
  }
}
```

这个 API 是首页 read model，不允许前端为了首页连续请求 12 个 endpoint。

---

# 7. Food Search

## GET /api/v1/foods/search

Query：

```text
q
limit=20
cursor
scope=all|local|custom|external
```

Response：

```json
{
  "data": [
    {
      "id": "food_x",
      "name": "馒头",
      "englishName": null,
      "brand": null,
      "source": "cfcd6",
      "quality": "A",
      "basis": {
        "amount": 100,
        "unit": "g"
      },
      "summary": {
        "energyKcal": 223,
        "proteinG": 7.0,
        "fatG": 1.1,
        "carbG": 47.0
      },
      "favorite": true,
      "recent": true
    }
  ]
}
```

搜索 endpoint 本身不触发 AI。

---

# 8. Food Detail

## GET /api/v1/foods/:foodId

返回：
- 基础字段；
- serving；
- nutrients；
- source；
- quality；
- alias；
- dataset version。

## POST /api/v1/foods/custom

创建自定义食物。

## PATCH /api/v1/foods/:foodId

只有 custom/user-label 可修改核心营养值。

Reference food 不允许直接编辑；
如果用户想改：
- 创建 override/custom copy。

## POST /api/v1/foods/:foodId/favorite

## DELETE /api/v1/foods/:foodId/favorite

---

# 9. Serving

## POST /api/v1/foods/:foodId/servings

```json
{
  "label": "我常买的1个",
  "amount": 82,
  "unit": "g",
  "isDefault": false
}
```

## PATCH /api/v1/foods/:foodId/servings/:servingId

## DELETE /api/v1/foods/:foodId/servings/:servingId

---

# 10. Diary

## GET /api/v1/diary/:date

返回完整当天：
- goal snapshot；
- meal slots；
- entries；
- meal totals；
- daily total；
- photos。

## POST /api/v1/diary/:date/entries

```json
{
  "mealSlotId": "breakfast",
  "foodId": "food_x",
  "amount": 75,
  "unit": "g",
  "servingId": null,
  "note": null,
  "source": "manual"
}
```

后端：
- 查 food；
- scale nutrient；
- snapshot；
- transaction write。

Response 必须返回 entry snapshot。

## PATCH /api/v1/diary/:date/entries/:entryId

修改 amount 或 meal slot 时重新生成 snapshot。

## DELETE /api/v1/diary/:date/entries/:entryId

## POST /api/v1/diary/:date/copy-meal

```json
{
  "fromDate": "2026-09-07",
  "fromMealSlotId": "breakfast",
  "toMealSlotId": "breakfast"
}
```

复制使用原 entry snapshot 还是当前 food 数据？

推荐：
- 默认使用**当前 food 数据重新计算**，因为它是一条“新记录”；
- 如果原 food 已不存在，则复制旧 snapshot 并标 `source=copy_snapshot`.

## POST /api/v1/diary/:date/copy-day

```json
{
  "fromDate": "2026-09-07"
}
```

复制当天所有餐次。active food（包括 serving）按当前食物数据重新快照；原食物或 serving 无法解析时保留原 entry snapshot，并标记 `source=copy_snapshot`。

---

# 11. Meal Photos

## POST /api/v1/diary/:date/meals/:mealSlotId/photos

multipart：
- file

后端：
- MIME 验证；
- 限制大小；
- 转为 webp/jpeg；
- 生成 thumbnail；
- sha256 dedupe。

## DELETE /api/v1/diary/photos/:photoId

---

# 12. Recipe

## GET /api/v1/recipes

## POST /api/v1/recipes

```json
{
  "name": "西红柿炒鸡蛋",
  "cookedWeightG": 330,
  "servingCount": 2,
  "ingredients": [
    {
      "foodId": "egg",
      "amount": 120,
      "unit": "g"
    },
    {
      "foodId": "tomato",
      "amount": 250,
      "unit": "g"
    },
    {
      "foodId": "oil",
      "amount": 10,
      "unit": "g"
    }
  ]
}
```

Response：
- total nutrient；
- per100g；
- per serving；
- warnings。

## PATCH /api/v1/recipes/:id

## DELETE /api/v1/recipes/:id

## POST /api/v1/recipes/:id/add-to-diary

```json
{
  "date": "2026-09-08",
  "mealSlotId": "dinner",
  "amount": 165,
  "unit": "g"
}
```

---

# 13. Body Weight

## GET /api/v1/body/weights

Query：
```text
from
to
limit
```

## POST /api/v1/body/weights

```json
{
  "measuredAt": "2026-09-08T06:20:00+08:00",
  "weightKg": 55.0,
  "note": ""
}
```

创建成功返回 `201` 和记录对象，记录包含服务端规范化的 UTC `measuredAt`、按当前 profile timezone 计算的 `localDate`、`source` 和 `version`。
同一 `localDate` 允许多条记录。

## PATCH /api/v1/body/weights/:id

请求体可包含 `measuredAt`、`weightKg`、`note` 和必填的 `version`；版本不匹配返回 `409 BODY_VERSION_CONFLICT`。

## DELETE /api/v1/body/weights/:id

请求体必须包含当前 `version`；版本不匹配返回 `409 BODY_VERSION_CONFLICT`，成功返回 `204`。

## GET /api/v1/body/weight-trend

Query：
```text
days=30
method=ewma
```

---

# 14. Activity

## GET /api/v1/activities/types

## POST /api/v1/activities

```json
{
  "date": "2026-09-08",
  "activityTypeId": "strength_training",
  "durationMin": 45,
  "met": 3.5
}
```

后端 snapshot 当前体重和 MET。

## PATCH /api/v1/activities/:id

## DELETE /api/v1/activities/:id

---

# 15. Analytics

## GET /api/v1/analytics/overview

Query：
```text
from
to
```

返回：
- avg intake；
- avg macros；
- adherence；
- weight delta；
- record coverage。

## GET /api/v1/analytics/nutrients

## GET /api/v1/analytics/weight

## GET /api/v1/analytics/tdee

Response：

```json
{
  "data": {
    "status": "available",
    "estimateKcal": 2070,
    "confidence": 0.74,
    "period": {
      "from": "2026-08-12",
      "to": "2026-09-08"
    },
    "methodVersion": "adaptive_tdee_v1"
  }
}
```

如果不足：

```json
{
  "data": {
    "status": "insufficient_data",
    "requirements": {
      "minimumDays": 21,
      "minimumWeightEntries": 8
    }
  }
}
```

---

# 16. AI Provider

## GET /api/v1/ai/providers

返回配置列表，但 API Key 只能：

```text
configured: true
```

不返回 key。

## POST /api/v1/ai/providers

```json
{
  "name": "My API",
  "providerType": "oai-compatible",
  "baseUrl": "https://example.com/v1",
  "apiKey": "...",
  "model": "model-name",
  "visionModel": "model-name",
  "supportsVision": true
}
```

## POST /api/v1/ai/providers/:id/test

测试：
- base url；
- auth；
- model；
- timeout。

## POST /api/v1/ai/providers/:id/test-vision

---

# 17. AI Daily Analysis

## POST /api/v1/ai/analyze/day

```json
{
  "date": "2026-09-08",
  "forceRefresh": false
}
```

流程：
1. build context；
2. hash；
3. 查 cache；
4. 未命中才调用模型；
5. schema validation；
6. cache；
7. 返回。

---

# 18. AI Natural Language Log

## POST /api/v1/ai/propose/food-log

```json
{
  "text": "早餐吃了一个75g馒头，20g燕麦，一个鸡蛋",
  "targetDate": "2026-09-08",
  "mealSlot": "breakfast"
}
```

返回：

```json
{
  "data": {
    "proposalId": "...",
    "items": [
      {
        "inputText": "75g馒头",
        "matchedFood": {
          "id": "...",
          "name": "馒头"
        },
        "amount": 75,
        "unit": "g",
        "confidence": 0.96,
        "needsConfirmation": true
      }
    ]
  }
}
```

不得返回“已经记录成功”。

## POST /api/v1/ai/proposals/:id/confirm

Body：

```json
{
  "items": [
    {
      "proposalItemIndex": 0,
      "foodId": "...",
      "amount": 75,
      "unit": "g"
    }
  ]
}
```

此 endpoint 最终调用 DiaryApplicationService。

## POST /api/v1/ai/proposals/:id/reject

---

# 19. AI Vision

## POST /api/v1/ai/propose/meal-photo

multipart：
- 1–4 photos
- date
- mealSlot

Response：
- food candidates；
- quantity guesses；
- uncertainty；
- hidden ingredients warnings。

只生成 proposal。

---

# 20. AI Conversation

## GET /api/v1/ai/conversations

## POST /api/v1/ai/conversations

## GET /api/v1/ai/conversations/:id/messages

## POST /api/v1/ai/conversations/:id/messages

可以使用 SSE 流式：

```text
POST → text/event-stream
```

事件：

```text
message.start
message.delta
message.completed
message.error
```

如果实现复杂，V1 可先非流式，后续再加。

---

# 21. Food Dataset Admin

这是“高级设置”。

## GET /api/v1/admin/food-datasets

## POST /api/v1/admin/food-datasets/import

输入可以：
- server local path；
- zip/json upload。

流程只进入 staging。

## GET /api/v1/admin/food-datasets/:id/validation

## GET /api/v1/admin/food-datasets/:id/diff

## POST /api/v1/admin/food-datasets/:id/promote

必须二次确认。

## DELETE /api/v1/admin/food-datasets/:id

只能删除 failed/archived staging。

---

# 22. Backup

## POST /api/v1/backups

```json
{
  "reason": "manual"
}
```

## GET /api/v1/backups

## GET /api/v1/backups/:id/download

## POST /api/v1/backups/restore/validate

multipart backup file。

返回：
- app version；
- schema；
- checksum；
- modules；
- compatibility。

## POST /api/v1/backups/restore

必须：
1. pre_restore backup；
2. validation；
3. maintenance lock；
4. restore；
5. integrity check；
6. restart/reload。

---

# 23. Import/Export

## GET /api/v1/export/diary.csv

## GET /api/v1/export/weight.csv

## GET /api/v1/export/full.json

Full JSON 是可移植数据，不等于 SQLite disaster backup。

---

# 24. 幂等性

以下 endpoint 支持：

```text
Idempotency-Key
```

建议：
- diary add；
- weight add；
- activity add；
- AI proposal confirm。

避免手机网络重试制造重复记录。

后端保存短期 idempotency result。

---

# 25. Concurrency

单用户也会出现：
- 手机 + PC 同时打开；
- 连点两次；
- PWA 重试。

PATCH 接口可以带：

```text
updatedAt / version
```

如果版本冲突：

```text
409 CONFLICT
```

首版至少 diary entry 和 recipe 做 optimistic concurrency。

---

# 26. Pagination

食物搜索 cursor，不用 page number。

体重/历史列表可 cursor。

Analytics 固定时间窗不分页。

---

# 27. API Security

- JSON body size limit；
- image size limit；
- backup upload size limit；
- CSRF 通过 SameSite + origin check；
- Fastify rate-limit 对 login/AI；
- AI provider URL 防 SSRF：
  - 默认允许 https；
  - LAN 自用模式可显式开启 private network base URL；
- 不允许 AI base URL 读取 file://。

---

# 28. AI Structured Output

推荐定义共享 Zod schema：

```text
AIParsedFoodLog
AIMealVisionProposal
AIDailyAnalysis
AIWeeklyAnalysis
```

模型输出必须：
1. parse；
2. validate；
3. 非法时最多 repair/retry 一次；
4. 再失败返回 AI_RESPONSE_INVALID。

不要在业务代码中到处 regex 拆 AI 自然语言。

---

# 29. Prompt Context 最小化

日分析只传：
- 当天 diary；
- 目标；
- macro totals；
- coverage；
- 当天运动；
- 可选近期趋势摘要。

不要默认把整个历史数据库发给模型。

周分析：
- 7/14 天 summary；
- 不是逐条把所有聊天和图片都传过去。

---

# 30. API 测试要求

每个 mutation API 至少测试：
- success；
- validation error；
- not found；
- conflict；
- database error mapping。

AI：
- provider timeout；
- 401；
- invalid JSON；
- no vision；
- proposal confirm stale food；
- proposal 重复确认。

Backup：
- corrupted zip；
- schema newer than app；
- checksum mismatch。

