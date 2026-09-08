<!--
文档版本：v1.0
日期：2026-09-08
项目定位：个人自用、自托管 Docker 饮食/体重/运动/减脂管理应用
设计原则：Local-first / Single-user-first / Modular Monolith / Data Traceability / AI as Assistant
-->

# FOOD_DATA_SPEC.md

## 1. 目标

食物数据层是整个系统最关键的基础设施。前端再精致，如果食物数据不可靠、不可追溯、不能更新，长期记录就没有价值。

本规范定义：

- 中国食物成分数据如何导入；
- 原始值如何保存；
- 数据如何规范化；
- 搜索如何工作；
- 数据质量如何分级；
- 外部数据源如何作为补充；
- 如何升级数据而不破坏历史；
- AI 如何参与但不篡改事实。

---

## 2. 首选中国数据源

第一版主数据源：

`https://github.com/Sanotsu/china-food-composition-data`

截至 2026-09-08，该仓库说明：

- 数据来源于《中国食物成分表标准版（第6版）》的“能量和食物一般营养成分”；
- 2026-08-25 版本约 1677 条食物、61 个类别；
- 使用两个视觉大模型交叉识别；
- 经过本地自动校验和人工定点复核；
- 提供原书识别版、fixed 矫正版、含英文名增强版；
- enhanced 数据中 1677 条里有 1242 条补充英文名；
- 还包含 GI 相关数据；
- 仓库特别提醒原书部分 kcal/kJ 数据本身存在疑点；
- 仓库主页未显示明确的开源 License 元数据。

本项目是个人自用，因此可将其作为本地数据导入来源。默认建议：

> 使用 `json_data_v3_20260825_qwen38max_kimi_k3_fixed_en` 作为首选导入源，但保留原始 JSON 和版本元信息，不把“fixed”视为绝对真理。

不得把该数据硬编码为“系统永远唯一正确”的数据。

---

## 3. 数据源优先级

### 3.1 本地搜索排序

推荐优先级：

1. 用户自己创建且标记“我的常用”
2. 用户录入的包装标签数据
3. 中国食物成分数据
4. 用户自定义菜谱
5. Open Food Facts
6. USDA FoodData Central
7. AI 临时候选

注意：

“优先显示”不完全等于“数据质量更高”，还要结合匹配度。

---

## 4. 数据质量等级

### A：高可信
典型：
- 用户自己照包装营养标签录入且确认；
- 官方/权威食物成分数据，经导入校验。

### B：较可信
典型：
- Open Food Facts 中字段完整、条码明确、最近有验证；
- USDA 对应通用食材。

### C：一般
典型：
- 用户自定义但来源不明确；
- 只有部分营养素。

### D：候选/估算
典型：
- AI 从图片估计；
- AI 从自然语言推断但未匹配到明确食物。

UI 中建议：
- A：不突出警告；
- B：小型 source chip；
- C：显示“用户数据/待核对”；
- D：必须显示“AI 估计，需确认”。

---

## 5. 原始数据不得丢失

Sanotsu 数据中可能出现：

```text
"2.50"
"Tr"
"—"
"091101x"
```

导入时必须保留 raw JSON 和每个 nutrient 的 raw string。

错误做法：

```js
Number("Tr") || 0
```

因为这会把“痕量”错误变成“精确 0”。

正确做法：

```text
amount_raw = "Tr"
amount_numeric = null
value_status = "trace"
```

对于 `"—"`：
- 不直接等于 0；
- 映射为 unknown；
- UI 显示 `—`；
- 统计时不计入总和；
- 同时计算 nutrient coverage。

---

## 6. 中国数据字段映射

建议 mapping：

```text
foodCode          → food_code
foodName          → primary_name
englishName       → english_name
edible            → edible_ratio / raw edible percent
water             → water_g
energyKCal        → energy_kcal
energyKJ          → energy_kj
protein           → protein_g
fat               → fat_g
CHO               → carbohydrate_g
dietaryFiber      → dietary_fiber_g
cholesterol       → cholesterol_mg
ash               → ash_g
vitaminA          → vitamin_a_ug
carotene          → carotene_ug
retinol           → retinol_ug
thiamin           → thiamin_mg
riboflavin        → riboflavin_mg
niacin            → niacin_mg
vitaminC          → vitamin_c_mg
vitaminETotal     → vitamin_e_mg
Ca                → calcium_mg
P                 → phosphorus_mg
K                 → potassium_mg
Na                → sodium_mg
Mg                → magnesium_mg
Fe                → iron_mg
Zn                → zinc_mg
Se                → selenium_ug
Cu                → copper_mg
Mn                → manganese_mg
remark            → source_notes
```

所有单位必须在 importer 中显式定义，不允许由列名“猜”。

---

## 7. Basis 规则

中国食物成分表的营养数值通常按每 100g 可食部表达。

内部统一：

```text
basis_amount = 100
basis_unit = g
basis_type = edible_portion
```

### 7.1 可食部

例如：

```text
edible = 63
```

应解释为可食部比例约 63%。

两种录入模式：

#### 默认模式
用户输入的是“实际吃下去的可食重量”。

```text
鸡肉 100g
```

直接按每 100g 可食部计算。

#### 高级模式
用户输入“带骨/带皮购买重量”。

```text
整鸡生重 500g
可食率 63%
estimated edible = 315g
```

高级模式不能默认打开，以免增加日常记录摩擦。

---

## 8. 数据导入流水线

推荐工具位置：

```text
tools/food-import/
```

流程：

```text
download / local folder
 ↓
calculate dataset checksum
 ↓
parse raw JSON
 ↓
staging tables
 ↓
schema validation
 ↓
semantic validation
 ↓
normalization
 ↓
diff active dataset
 ↓
generate report
 ↓
manual approval
 ↓
transactional promote
 ↓
rebuild search index
```

### 8.1 Staging

绝对不要导入时直接 UPDATE active food 表。

先写：
- staging_dataset
- staging_food
- staging_nutrients

验证完成后再 promote。

---

## 9. Import Validation

必须检查：

### 结构
- foodCode 非空；
- foodName 非空；
- 同 dataset foodCode 不重复；
- nutrient key 在 mapping 中；
- JSON 可解析。

### 数值
- 不能负数；
- edible 0–100；
- macro 合理范围；
- energy 不为极端异常值。

### kcal/kJ
只作为一致性警告，不自动覆盖：

```text
expected_kJ ≈ kcal × 4.184
```

容许原始表本身存在不一致。

例如：
- 警告差异 > 10%；
- 标记 `energy_inconsistency=true`；
- 仍保留 source raw。

### 双重能量验证
可以计算：

```text
derived kcal ≈ protein*4 + carbohydrate*4 + fat*9
```

但只作为 quality signal。

不能因为 Atwater 推导不同，就自动覆盖 source energy。

---

## 10. 数据集版本升级

每次导入生成：

```json
{
  "datasetKey": "cfcd6-sanotsu",
  "version": "20260825-fixed-en",
  "checksum": "...",
  "recordCount": 1677,
  "sourceCommit": "...",
  "importerVersion": "1.0.0"
}
```

### Diff

生成：

```text
added
removed
changed_name
changed_macro
changed_micronutrient
changed_edible
changed_energy
```

任何 active dataset 切换前必须能够查看 diff。

---

## 11. Canonicalization

不能直接拿 `foodName` 做唯一键。

使用：

```text
canonical_key = source_namespace + ":" + stable_source_id
```

例如：

```text
cfcd6:091101x
off:6901234567890
usda:fdc:171688
custom:0199...
```

这样同名食物可以共存。

---

## 12. 别名系统

中文饮食搜索的体验取决于 alias。

### 内置别名
示例：

```text
西红柿 / 番茄
土豆 / 马铃薯 / 洋芋
西葫芦 / 生瓜（地区用法）
地瓜 / 红薯 / 甘薯
玉米 / 苞米
```

### 用户别名

用户可以给食物增加：

```text
“我常买的馒头”
“超市希腊酸奶”
“早餐燕麦”
```

### 拼音索引

预计算：

```text
primary_name_pinyin
pinyin_initials
```

例如：

```text
西红柿 → xihongshi → xhs
```

---

## 13. 搜索打分

建议 scoring：

```text
exact custom favorite        +100
exact primary_name           +90
exact alias                  +85
prefix primary_name          +75
recently used                +0~30
favorite                     +25
pinyin prefix                +45
fuzzy                        +20
external source              -10
inactive                     hidden
```

查询 “苹果” 时：
- 苹果（代表值）；
- 红富士苹果；
- 用户常吃苹果；
- 苹果汁；

均可以出现，但最近使用/常用应优先。

---

## 14. Search Latency

本地库约几千至几十万条时：

- 先普通 indexed query；
- 再 alias；
- 再 FTS；
- 最后才 external API。

输入防抖：

```text
150–250ms
```

不要每个按键请求 OFF。

---

## 15. Open Food Facts 可选接入

用途：
- 包装商品；
- 条码；
- 用户偶尔查品牌食品。

策略：

```text
local barcode
 ↓
OFF API
 ↓
result preview
 ↓
用户确认
 ↓
canonicalize to local food_item
```

外部结果一旦被用户使用，复制必要字段到本地，不让历史日记依赖远程 API。

字段质量：
- 核心宏量缺失 → 提示；
- nutrition grade 等附加字段不参与核心计算；
- 保留 source URL 和 barcode。

---

## 16. USDA 可选接入

用途：
- 中国库没有的通用食材；
- 补充部分国际食物；
- 营养微量数据对比。

依旧采用：
- 查询；
- 用户选择；
- canonicalize；
- 本地 snapshot。

不要自动拿 USDA 的同名食物替换中国数据。

---

## 17. 用户包装标签数据

对于日常自用，这通常比模糊搜索数据库更准确。

表单：

```text
食物名
品牌
条码（可选）
每100g / 每100ml / 每份
能量
蛋白质
脂肪
碳水
钠
其他营养素（可选）
```

支持拍照后 AI/OCR 提取，但必须用户确认。

确认后：
- source_type=user_label；
- quality=A；
- raw label image 可保存；
- 日后扫码直接复用。

---

## 18. Serving 设计

食物可以有多个 serving：

```text
燕麦：
  100g
  20g 一小份
  12g 我的勺

馒头：
  100g
  50g 小
  75g 中
  100g 大
  82g 我常买的1个
```

用户选 serving 后内部统一转 g/ml。

不能把“1个”作为没有克重的神秘单位长期保存。

---

## 19. Density

对液体：

```text
density_g_ml
```

如果数据源按 100ml，本身可直接按 ml。

如果只有 100g：
- 有 density 才能把 ml 转 g；
- 没有 density 时不擅自假设 1ml=1g；
- UI 提示“请输入克数或设置密度”。

---

## 20. Recipe 与普通食物关系

菜谱最终可视为一种 `food_type=recipe`，但原始组成由 Recipe 模块维护。

菜谱营养来自：
- ingredient snapshot；
- cooked yield；
- serving count。

不能手工修改 recipe 的宏量 cache，否则来源链断裂。

---

## 21. AI 的边界

### AI 可以
- 把“半个苹果”解析成候选量；
- 从图片提出“像是西红柿炒蛋”；
- 提示可能含油；
- 给出本地库搜索关键词；
- 从标签图片提取文本；
- 对两个候选食物做解释。

### AI 不可以
- 凭空写入最终 412 kcal；
- 将未确认图片估算标为 A 级数据；
- 覆盖 source database；
- 自动“修正”中国成分表原始值。

---

## 22. 数据覆盖率

全天统计时，除了 kcal 等总数，可计算：

```text
nutrient_coverage = 已知值的食物重量 / 总记录重量
```

更精确可以按 entry 权重计算。

如果某日铁摄入只有 60% 的条目有数据：

UI：
```text
铁：估计 8.4mg
数据覆盖约 60%
```

避免制造虚假精确感。

---

## 23. 图片

食物图片不是营养事实，不应成为数据主键。

优先级：
1. user local photo；
2. bundled generic local image；
3. remote URL cached；
4. placeholder icon。

导入外部图片应：
- 下载缩略图；
- 限制尺寸；
- 设置缓存；
- 远程失效不影响食物记录。

---

## 24. 备份与食物数据

备份分两类：

### 用户数据备份
包含：
- custom food；
- servings；
- aliases；
- diary；
- recipes；
- weight；
- activity。

### Reference dataset
可重新导入，不必每个日常 backup 都复制原始 1677 JSON。

但完整 disaster backup 可以包含：
- active dataset manifest；
- importer version；
- source checksum。

---

## 25. 数据来源展示

食物详情底部建议：

```text
数据来源
中国食物成分表（第6版）整理数据
foodCode: 091101x
数据版本: 20260825-fixed-en
质量等级: A
```

如果是 OFF：

```text
Open Food Facts
条码: ...
最后同步: ...
质量等级: B
```

---

## 26. 自用场景的版权注意

因为 Sanotsu 仓库的数据来源于书籍截图整理，且仓库主页当前没有显式 License 展示：

- 本项目仅自用时，可将其作为本地导入源；
- 不建议默认把原始书籍截图或整套重打包数据随自己的公开镜像分发；
- Docker image 设计成“首次启动从本地 data seed 导入”比把源数据焊死在镜像更稳妥；
- 如果以后公开发布，再重新核对数据授权。

---

## 27. Golden Food Tests

固定维护 20–50 个黄金样本：

```text
鸡（代表值）
馒头
燕麦
苹果
鸡蛋
牛奶
橄榄油
土豆
西红柿
西葫芦
```

每次 importer 更新验证：
- foodCode 不变；
- 核心 macro 是否变化；
- raw string 是否保真；
- `Tr` 仍为 trace；
- 搜索别名正常；
- serving 换算正常。

这组测试比只测试 importer “不报错”更重要。

---

## 28. 外部数据参考

- 中国食物整理数据：https://github.com/Sanotsu/china-food-composition-data
- Free-Fitness 对该数据的实际使用方式：https://github.com/Sanotsu/free-fitness
- Open Food Facts API 文档：https://openfoodfacts.github.io/openfoodfacts-server/api/
- USDA FoodData Central：https://fdc.nal.usda.gov/

开发时应把“数据来源”与“应用自己的 canonical schema”严格分离，任何第三方数据都通过 importer/adaptor 进入系统。
