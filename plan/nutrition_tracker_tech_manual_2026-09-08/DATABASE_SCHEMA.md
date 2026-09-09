<!--
文档版本：v1.0
日期：2026-09-08
项目定位：个人自用、自托管 Docker 饮食/体重/运动/减脂管理应用
设计原则：Local-first / Single-user-first / Modular Monolith / Data Traceability / AI as Assistant
-->

# DATABASE_SCHEMA.md

## 1. 数据库原则

数据库使用 SQLite，开启 WAL、foreign_keys、busy_timeout。数据库不仅要“能存数据”，还必须满足：

1. **历史不可漂移**：日记记录保存营养快照；
2. **数据源可追溯**：每个食物知道来自哪里、哪一版；
3. **未知值不伪装为 0**；
4. **食物数据库升级与用户数据分离**；
5. **AI 不直接拥有业务事实**；
6. **模块表名具有前缀，降低跨模块误访问风险**。

建议表名前缀：

```text
core_
profile_
food_
diary_
recipe_
body_
activity_
analytics_
ai_
backup_
```

---

## 2. SQLite 初始化

```sql
PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;
PRAGMA synchronous = NORMAL;
PRAGMA busy_timeout = 5000;
PRAGMA temp_store = MEMORY;
```

所有时间字段存 ISO-8601 UTC 或 integer unix epoch，推荐 integer milliseconds。

金额不存在，不需要 decimal money 类型；营养数字统一用 REAL，但保留原始字符串字段。

---

# 3. Core

## 3.1 core_schema_migrations

| 字段 | 类型 | 说明 |
|---|---|---|
| version | TEXT PK | migration id |
| applied_at | INTEGER | 执行时间 |
| checksum | TEXT | migration 文件 hash |
| duration_ms | INTEGER | 耗时 |

## 3.2 core_settings

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| key | TEXT | PK | 设置名 |
| value_json | TEXT | NOT NULL | JSON |
| encrypted | INTEGER | 0/1 | 是否加密 |
| updated_at | INTEGER | NOT NULL | |

严禁将明文 AI key 写入普通 setting。

## 3.3 core_audit_log

仅记录重要系统操作，不记录每个普通 UI 点击。

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| event_type | TEXT |
| module | TEXT |
| entity_type | TEXT |
| entity_id | TEXT nullable |
| payload_json | TEXT nullable |
| created_at | INTEGER |

重要事件：
- DATABASE_MIGRATED
- FOOD_DATASET_PROMOTED
- BACKUP_CREATED
- BACKUP_RESTORED
- AI_CONFIG_CHANGED

---

# 4. Profile

## 4.1 profile_user

单用户首版也保留 user_id，避免未来迁移困难。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | UUIDv7/ULID |
| display_name | TEXT | |
| password_hash | TEXT nullable | trusted LAN 可空 |
| timezone | TEXT | 如 Asia/Shanghai |
| unit_system | TEXT | metric |
| created_at | INTEGER | |
| updated_at | INTEGER | |

## 4.2 profile_body_profile

用于当前身体基础资料。

| 字段 | 类型 | 说明 |
|---|---|---|
| user_id | TEXT PK/FK | |
| birth_date | TEXT nullable | YYYY-MM-DD |
| sex_for_formula | TEXT nullable | male/female/none |
| height_cm | REAL nullable | |
| activity_level | TEXT nullable | sedentary/light/moderate/high/very_high |
| updated_at | INTEGER | |

如果用户不希望使用性别公式，可设置 none，并使用自定义热量目标。

## 4.3 profile_nutrition_goal

目标应版本化，避免历史页面拿“今天的新目标”覆盖过去目标。

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| effective_from | TEXT |
| effective_to | TEXT nullable |
| goal_type | TEXT |
| calorie_target_kcal | REAL |
| protein_target_g | REAL nullable |
| fat_target_g | REAL nullable |
| carb_target_g | REAL nullable |
| fiber_target_g | REAL nullable |
| source | TEXT |
| created_at | INTEGER |

唯一约束：
- 同一用户 active goal 只能一个。

`source`：
- manual
- formula
- adaptive

---

# 5. Food Catalog

## 5.1 food_dataset

表示一套外部食物数据版本。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| dataset_key | TEXT | cfcd6-sanotsu |
| version | TEXT | 20260825-fixed-en |
| source_name | TEXT | |
| source_url | TEXT nullable | |
| source_notes | TEXT nullable | |
| checksum | TEXT | 整体 hash |
| imported_at | INTEGER | |
| promoted_at | INTEGER nullable | |
| status | TEXT | staging/active/archived/failed |
| record_count | INTEGER | |
| validation_json | TEXT | |
| metadata_json | TEXT | |

索引：

```sql
CREATE INDEX idx_food_dataset_key_version
ON food_dataset(dataset_key, version);
```

## 5.2 food_item

Canonical 食物主表。

| 字段 | 类型 | 约束 | 说明 |
|---|---|---|---|
| id | TEXT | PK | |
| canonical_key | TEXT | UNIQUE | 稳定内部 key |
| primary_name | TEXT | NOT NULL | 中文显示名 |
| search_key | TEXT | NOT NULL | 规范化主名称；用于精确/前缀本地搜索索引 |
| english_name | TEXT nullable | | |
| brand | TEXT nullable | | 商品品牌 |
| food_code | TEXT nullable | | CFCD foodCode |
| category_id | TEXT nullable | FK | |
| food_type | TEXT | | generic/branded/recipe/custom |
| default_basis | TEXT | | edible_100g / liquid_100ml / serving |
| edible_ratio | REAL nullable | | 0–1 |
| density_g_ml | REAL nullable | | 液体体积换算 |
| source_quality | TEXT | | A/B/C/D |
| active | INTEGER | | |
| created_at | INTEGER | | |
| updated_at | INTEGER | | |

`canonical_key` 例：
- `cfcd6:091101x`
- `off:6901234567890`
- `custom:<uuid>`

## 5.3 food_category

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| parent_id | TEXT nullable FK |
| name | TEXT |
| sort_order | INTEGER |
| source_dataset_id | TEXT nullable |

## 5.4 food_source_record

保留“数据从哪里来的”。

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| food_id | TEXT FK |
| dataset_id | TEXT nullable FK |
| source_type | TEXT |
| source_record_id | TEXT nullable |
| raw_json | TEXT |
| source_url | TEXT nullable |
| source_notes | TEXT nullable | 保留来源记录级备注，如 CFCD `remark` |
| imported_at | INTEGER |
| is_primary | INTEGER |

`source_type`：
- cfcd6
- user_label
- custom
- off
- usda
- ai_ocr_candidate

AI 识别未确认的数据不能直接标记 primary。

---

# 6. 营养素模型

## 6.1 food_nutrient_definition

营养素定义表。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | 如 energy_kcal |
| display_name | TEXT | 热量 |
| unit | TEXT | kcal/kJ/g/mg/µg；`energy_kj` 必须为 `kJ` |
| nutrient_group | TEXT | macro/vitamin/mineral/other |
| display_order | INTEGER | |
| summable | INTEGER | |

预置：
- energy_kcal
- energy_kj
- water_g
- protein_g
- fat_g
- carbohydrate_g
- dietary_fiber_g
- cholesterol_mg
- vitamin_a_ug
- carotene_ug
- retinol_ug
- thiamin_mg
- riboflavin_mg
- niacin_mg
- vitamin_c_mg
- vitamin_e_mg
- calcium_mg
- phosphorus_mg
- potassium_mg
- sodium_mg
- magnesium_mg
- iron_mg
- zinc_mg
- selenium_ug
- copper_mg
- manganese_mg

## 6.2 food_nutrient_value

一条食物在其基准份量下的营养值。

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK |
| food_id | TEXT FK |
| source_record_id | TEXT FK |
| nutrient_id | TEXT FK |
| amount_numeric | REAL nullable |
| amount_raw | TEXT nullable |
| value_status | TEXT |
| basis_amount | REAL |
| basis_unit | TEXT |
| confidence | REAL nullable |
| created_at | INTEGER |

`value_status`：

```text
known
trace
unknown
not_applicable
estimated
```

重要规则：

- `"Tr"`：
  - `amount_raw='Tr'`
  - `amount_numeric=NULL`
  - `value_status='trace'`

- `"—"`：
  - `amount_raw='—'`
  - `amount_numeric=NULL`
  - `value_status='unknown'` 或根据数据源映射

不要将 trace 与 unknown 都写成 0。

唯一索引：

```sql
UNIQUE(food_id, source_record_id, nutrient_id)
```

---

# 7. 食物搜索与份量

## 7.1 food_alias

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| food_id | TEXT FK |
| alias | TEXT |
| alias_normalized | TEXT |
| alias_type | TEXT |
| user_defined | INTEGER |

`alias_type`：
- synonym
- regional
- pinyin
- abbreviation
- english

例：

```text
番茄 → 西红柿
马铃薯 → 土豆
洋芋 → 土豆
```

## 7.2 food_serving

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK |
| food_id | TEXT FK |
| label | TEXT | 1个中等 |
| amount | REAL | 75 |
| unit | TEXT | g/ml |
| equivalent_g | REAL nullable | |
| equivalent_ml | REAL nullable | |
| sort_order | INTEGER | |
| source | TEXT | built_in/user |
| is_default | INTEGER | |

用户可以创建：
- `我买的馒头 1个=82g`
- `我的燕麦勺 1勺=12g`

## 7.3 food_search_stats

| 字段 | 类型 |
|---|---|
| food_id | TEXT PK |
| use_count | INTEGER |
| last_used_at | INTEGER |
| favorite | INTEGER |
| recent_score | REAL |

---

# 8. Food FTS

建议建立 SQLite FTS5 虚拟表：

```sql
CREATE VIRTUAL TABLE food_search_fts USING fts5(
  food_id UNINDEXED,
  primary_name,
  aliases,
  english_name,
  pinyin,
  brand,
  tokenize='unicode61'
);
```

中文精确/别名匹配优先在普通表处理，FTS 作为补充。

如果中文 FTS 分词效果不足，使用预生成 search tokens：

```text
西红柿 番茄 xihongshi xhs
```

---

# 9. Diary

## 9.1 diary_day

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| local_date | TEXT |
| goal_id | TEXT nullable FK |
| note | TEXT nullable |
| created_at | INTEGER |
| updated_at | INTEGER |

唯一：
```sql
UNIQUE(user_id, local_date)
```

## 9.2 diary_meal_slot

用户可配置餐次。

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| key | TEXT |
| display_name | TEXT |
| sort_order | INTEGER |
| active | INTEGER |

默认：
- breakfast
- lunch
- dinner
- snack

## 9.3 diary_entry

| 字段 | 类型 | 说明 |
|---|---|---|
| id | TEXT PK | |
| diary_day_id | TEXT FK | |
| meal_slot_id | TEXT FK | |
| food_id | TEXT nullable FK | 原食物可被删除 |
| recipe_id | TEXT nullable FK | |
| display_name_snapshot | TEXT | 历史名称 |
| source_snapshot | TEXT | |
| amount | REAL | |
| unit | TEXT | g/ml/serving |
| gram_equivalent | REAL nullable | |
| serving_label_snapshot | TEXT nullable | |
| note | TEXT nullable | |
| entry_source | TEXT | manual/ai_confirmed/copy/import |
| created_at | INTEGER | |
| updated_at | INTEGER | |

## 9.4 diary_entry_nutrient

这是历史真实性的核心。

| 字段 | 类型 |
|---|---|
| entry_id | TEXT FK |
| nutrient_id | TEXT FK |
| amount_numeric | REAL nullable |
| amount_raw | TEXT nullable |
| value_status | TEXT |
| source_basis_json | TEXT nullable |

PK：
```sql
PRIMARY KEY(entry_id, nutrient_id)
```

因此 food_item 更新不会重算旧记录。

## 9.5 diary_meal_photo

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| diary_day_id | TEXT FK |
| meal_slot_id | TEXT FK |
| file_path | TEXT |
| thumb_path | TEXT |
| sha256 | TEXT |
| width | INTEGER |
| height | INTEGER |
| created_at | INTEGER |

---

# 10. Recipe

## 10.1 recipe

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| name | TEXT |
| cooked_weight_g | REAL nullable |
| serving_count | REAL nullable |
| note | TEXT nullable |
| created_at | INTEGER |
| updated_at | INTEGER |

## 10.2 recipe_ingredient

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| recipe_id | TEXT FK |
| food_id | TEXT nullable FK |
| name_snapshot | TEXT |
| input_amount | REAL |
| input_unit | TEXT |
| gram_equivalent | REAL nullable |
| sort_order | INTEGER |

## 10.3 recipe_nutrient_cache

用于加速，不是唯一事实。

| 字段 | 类型 |
|---|---|
| recipe_id | TEXT |
| nutrient_id | TEXT |
| total_amount | REAL nullable |
| per_100g_amount | REAL nullable |
| per_serving_amount | REAL nullable |
| computed_at | INTEGER |
| calc_version | TEXT |

如果 ingredient 变化，cache 失效。

---

# 11. Body

## 11.1 body_weight_entry

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| measured_at | INTEGER |
| local_date | TEXT |
| weight_kg | REAL |
| source | TEXT |
| note | TEXT nullable |
| created_at | INTEGER |

索引：
```sql
INDEX(user_id, measured_at)
```

允许同日多次测量，趋势层决定使用：
- 当日最后一次；
- 当日平均；
- 用户指定首选。

## 11.2 body_measurement_entry

可选围度通用模型。

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| type | TEXT |
| measured_at | INTEGER |
| value | REAL |
| unit | TEXT |

---

# 12. Activity

## 12.1 activity_type

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| name | TEXT |
| met | REAL nullable |
| category | TEXT |
| source | TEXT |

## 12.2 activity_entry

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| local_date | TEXT |
| activity_type_id | TEXT nullable |
| display_name_snapshot | TEXT |
| duration_min | REAL |
| met_snapshot | REAL nullable |
| weight_kg_snapshot | REAL nullable |
| calorie_burn_kcal | REAL nullable |
| calorie_source | TEXT |
| started_at | INTEGER nullable |
| note | TEXT nullable |
| created_at | INTEGER |

必须 snapshot MET 和 weight，否则未来重算会漂移。

---

# 13. Analytics

不要预先把所有统计都存表。优先 query + materialized read cache。

## 13.1 analytics_daily_summary

可重建缓存：

| 字段 | 类型 |
|---|---|
| user_id | TEXT |
| local_date | TEXT |
| intake_kcal | REAL |
| exercise_kcal | REAL |
| protein_g | REAL |
| fat_g | REAL |
| carb_g | REAL |
| fiber_g | REAL nullable |
| weight_kg | REAL nullable |
| goal_kcal | REAL nullable |
| computed_at | INTEGER |
| calc_version | TEXT |

PK：
```sql
PRIMARY KEY(user_id, local_date)
```

---

# 14. Adaptive TDEE

## 14.1 analytics_tdee_estimate

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| period_start | TEXT |
| period_end | TEXT |
| days | INTEGER |
| avg_intake_kcal | REAL |
| start_trend_weight_kg | REAL |
| end_trend_weight_kg | REAL |
| weight_change_kg | REAL |
| estimated_tdee_kcal | REAL |
| confidence | REAL |
| method_version | TEXT |
| created_at | INTEGER |

旧估计保留，方便观察算法版本变化。

---

# 15. AI

## 15.1 ai_provider_config

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| name | TEXT |
| provider_type | TEXT |
| base_url | TEXT |
| api_key_encrypted | TEXT nullable |
| model | TEXT |
| vision_model | TEXT nullable |
| supports_vision | INTEGER |
| timeout_ms | INTEGER |
| enabled | INTEGER |
| created_at | INTEGER |
| updated_at | INTEGER |

## 15.2 ai_conversation

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| user_id | TEXT FK |
| context_type | TEXT |
| context_id | TEXT nullable |
| title | TEXT |
| provider_config_id | TEXT |
| context_hash | TEXT nullable |
| created_at | INTEGER |
| updated_at | INTEGER |

`context_type`：
- general
- diary_day
- meal_photo
- weight_period
- recipe

## 15.3 ai_message

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| conversation_id | TEXT FK |
| role | TEXT |
| content_json | TEXT |
| token_input | INTEGER nullable |
| token_output | INTEGER nullable |
| created_at | INTEGER |

## 15.4 ai_analysis_cache

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| context_type | TEXT |
| context_id | TEXT |
| context_hash | TEXT |
| analysis_type | TEXT |
| result_json | TEXT |
| model | TEXT |
| created_at | INTEGER |

唯一：
```sql
UNIQUE(context_type, context_id, context_hash, analysis_type)
```

当日食物数据未变，复用分析。

## 15.5 ai_proposal

所有 AI 写入建议都先存 proposal。

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| proposal_type | TEXT |
| source_conversation_id | TEXT nullable |
| payload_json | TEXT |
| status | TEXT |
| created_at | INTEGER |
| confirmed_at | INTEGER nullable |

status：
- pending
- confirmed
- rejected
- expired

---

# 16. External Integrations

## 16.1 integration_cache

| 字段 | 类型 |
|---|---|
| provider | TEXT |
| cache_key | TEXT |
| response_json | TEXT |
| expires_at | INTEGER |
| created_at | INTEGER |

PK：
```sql
PRIMARY KEY(provider, cache_key)
```

External result 一旦被用户选中，应该转入 food_item/source_record，而不是日记长期依赖 cache。

---

# 17. Backup

## 17.1 backup_record

| 字段 | 类型 |
|---|---|
| id | TEXT PK |
| file_name | TEXT |
| file_path | TEXT |
| sha256 | TEXT |
| app_version | TEXT |
| schema_version | TEXT |
| db_size_bytes | INTEGER |
| created_at | INTEGER |
| reason | TEXT |
| status | TEXT |

reason：
- manual
- pre_migration
- scheduled
- pre_restore

---

# 18. 数据删除规则

### food_item
不硬删除有历史引用的食物：
```text
active=0
```

### recipe
如果日记历史已 snapshot，可 soft delete。

### diary_entry
用户删除可以 hard delete，但 audit 不保存详细营养内容。

### body_weight_entry
可 hard delete。

### dataset
active dataset 不允许删除；
archived dataset 可删除 raw record，但不删除已经 canonicalized 的历史源信息。

---

# 19. 数据一致性约束

建议：

```sql
CHECK(edible_ratio IS NULL OR edible_ratio BETWEEN 0 AND 1)
CHECK(density_g_ml IS NULL OR density_g_ml > 0)
CHECK(weight_kg > 0)
CHECK(duration_min >= 0)
CHECK(basis_amount > 0)
```

程序级校验：
- kcal 不允许负值；
- macro 不允许负值；
- mg/µg 不允许负值；
- AI proposal 写入前必须重新验证 food_id 与 amount。

---

# 20. 数据库版本与计算版本

任何可能改变历史统计解释的算法都带版本：

```text
nutrition_calc_version
recipe_calc_version
tdee_method_version
analytics_calc_version
```

目的：
- 算法升级后可以区分旧值与新值；
- 能重建 cache；
- 出现异常时可回滚。

---

# 21. 必须编写的迁移测试

每个 schema migration 至少验证：

1. 空数据库可迁移；
2. 上一个 release DB 可迁移；
3. migration 重复执行不会重复破坏；
4. foreign key 完整；
5. diary snapshot 数量不变；
6. weight 条数不变；
7. food canonical key 不冲突；
8. rollback 使用备份可恢复。

---

# 22. 关键 SQL 查询性能目标

食物搜索：
```text
p95 < 100ms
```

今日 Dashboard：
```text
p95 < 100ms
```

30 天趋势：
```text
p95 < 150ms
```

AI 请求不计入上述目标。

索引重点：
- diary_day(user_id, local_date)
- diary_entry(diary_day_id, meal_slot_id)
- body_weight_entry(user_id, measured_at)
- food_item(food_code)
- food_alias(alias_normalized)
- ai_analysis_cache(context_id, context_hash)
