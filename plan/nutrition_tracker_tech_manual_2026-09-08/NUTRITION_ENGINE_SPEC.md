<!--
文档版本：v1.0
日期：2026-09-08
项目定位：个人自用、自托管 Docker 饮食/体重/运动/减脂管理应用
设计原则：Local-first / Single-user-first / Modular Monolith / Data Traceability / AI as Assistant
-->

# NUTRITION_ENGINE_SPEC.md

## 1. 目标

Nutrition Engine 是一个**纯确定性、可测试、无 UI、无数据库依赖**的核心包：

```text
packages/nutrition-engine
```

输入：
- 食物营养基准；
- 份量；
- 体重/身高/年龄；
- 运动；
- 菜谱；
- 目标配置。

输出：
- 确定性营养结果；
- 计算版本；
- coverage；
- warning；
- confidence metadata。

AI 不得参与本模块计算。

---

## 2. API 风格

建议纯函数：

```ts
scaleNutrients(input): NutrientResult
calculateRecipe(input): RecipeNutrition
calculateBmr(input): BmrResult
calculateTdee(input): TdeeResult
calculateExerciseEnergy(input): ExerciseEnergyResult
estimateAdaptiveTdee(input): AdaptiveTdeeResult
```

函数：
- 同一输入必须得到同一输出；
- 不访问 DB；
- 不访问系统时间；
- 不访问网络；
- 不读取环境变量。

---

# 3. 食物份量缩放

如果食物数据为每 100g：

```text
source_value = X
amount_g = W
```

则：

\[
N = X \times \frac{W}{100}
\]

例：

```text
馒头 223 kcal/100g
吃 75g

223 × 0.75 = 167.25 kcal
```

展示层可以显示 167 kcal；
数据库 snapshot 建议保留 2–4 位小数。

---

## 4. 单位换算

内部基础质量单位统一：

```text
g
```

内部液体基础单位：

```text
ml
```

### serving → g

```text
1 medium bun = 75g
2 servings = 150g
```

### ml → g

仅当 food 有 density：

\[
mass(g) = volume(ml) \times density(g/ml)
\]

无 density 时不得默认 1:1，除非数据本身 basis 就是 100ml。

---

# 5. 可食部

默认用户输入“吃进去的可食部分重量”。

高级输入 gross weight：

\[
edibleWeight = grossWeight \times edibleRatio
\]

例：

```text
gross 500g
edible ratio 0.63
edible = 315g
```

UI 必须区分：
- 食用重量；
- 带骨/带皮总重。

---

# 6. Macro Energy

### 首选值

如果 source 明确提供 energy kcal：

```text
displayed energy = source scaled kcal
```

不要自动用宏量推导值覆盖。

### 校验值

传统近似：

\[
E_{macro}=4P+4C+9F
\]

如果支持酒精：

\[
+7A
\]

如果未来支持有机酸/膳食纤维不同能量因子，应按具体标准增加版本化 factor profile。

### 用途
- 数据质量验证；
- source kcal 缺失时 fallback；
- 不做 silent overwrite。

---

# 7. Unknown 与 Trace

定义：

```text
known      → 有明确数值
trace      → 痕量
unknown    → 未提供/无法确定
estimated  → 估算
```

### 汇总行为

`known`：
- 正常求和。

`trace`：
- 展示 `Tr`；
- 默认数值总和按 0 处理，但 summary 必须保留 `hasTrace=true`；
- 不能展示成“精确 0.00”。

`unknown`：
- 不参与数值求和；
- coverage 降低。

`estimated`：
- 参与求和；
- 标记 estimated coverage。

---

# 8. Coverage

对每个 nutrient：

\[
coverage=\frac{\sum knownEntryWeight}{\sum relevantEntryWeight}
\]

V1 可以用 entry gram equivalent 做权重。

返回：

```json
{
  "nutrient": "iron_mg",
  "amount": 8.42,
  "coverage": 0.71,
  "hasTrace": true,
  "hasEstimated": false
}
```

UI：
- coverage >= 0.9：正常；
- 0.6–0.9：小型信息提示；
- <0.6：提示“数据覆盖不足”。

这些阈值是 UI 信息质量规则，不是健康阈值。

---

# 9. Recipe Calculation

输入：

```text
Ingredient A
Ingredient B
Ingredient C
```

总营养：

\[
N_{total}=\sum N_i
\]

如果成品重量：

```text
cookedWeight = Wc
```

则：

\[
N_{100g}=\frac{N_{total}}{W_c}\times100
\]

每份：

\[
N_{serving}=\frac{N_{total}}{servingCount}
\]

### 重要原则

水分蒸发导致“每100g营养密度变化”，但总蛋白/脂肪/碳水不会因为成品重量变小而凭空增加。

因此必须保存：
- ingredient input；
- total nutrient；
- cooked yield。

---

# 10. Nutrient Retention

V1：
- 不默认应用 retention factor；
- 菜谱只做“原料营养总和 + cooked weight yield”。

未来可添加：

```text
retention_profile
```

计算：

\[
N_{retained}=N_{raw}\times RF
\]

不同：
- vitamin C；
- thiamin；
- folate；

可能需要不同 RF。

必须版本化，不能升级后改变旧日记 snapshot。

---

# 11. BMR

默认使用 Mifflin–St Jeor 作为公式模式之一。

### 男

\[
BMR = 10W + 6.25H - 5A + 5
\]

### 女

\[
BMR = 10W + 6.25H - 5A - 161
\]

其中：
- W = kg；
- H = cm；
- A = 岁。

用户可以：
- 不使用公式；
- 直接设 calorie target。

系统必须区分：

```text
estimated_bmr
manual_calorie_target
```

不要把公式值描述成测量值。

---

# 12. TDEE

基础：

\[
TDEE=BMR\times activityFactor
\]

默认 factor 可配置：

```text
sedentary  1.20
light      1.375
moderate   1.55
high       1.725
very_high  1.90
```

这些只是估算档位。

UI 应使用“估算维持热量”。

---

# 13. 减脂/增重目标

推荐引擎只提供数学能力，不主动做医疗处方。

```text
targetCalories = estimatedTDEE + userChosenAdjustment
```

例如：
- -300；
- +200。

或者按百分比：

```text
adjustmentPercent
```

必须显示：
- 这是估算；
- 用户可完全手动覆盖。

系统不应自动持续下调热量来追求某个体重速度。

---

# 14. 运动能量

如果使用 MET：

\[
kcal/min = \frac{MET\times3.5\times weightKg}{200}
\]

\[
kcal = kcal/min\times minutes
\]

记录时 snapshot：
- MET；
- weight；
- duration；
- resulting kcal；
- formula version。

### 强烈注意双重计算

如果 TDEE 的 activity factor 已包含日常运动，又把全部运动 kcal 加回预算，会 double-count。

因此默认：

```text
exercise_budget_mode = display_only
```

可选：

```text
display_only
eat_back_50
eat_back_100
```

更高级可以：
- sedentary baseline + explicit activity。

---

# 15. 今日热量环

定义必须固定。

截图风格中的：

```text
饮食摄入 389
运动消耗 0
还可以吃 1545
推荐预算 1934
```

推荐公式：

\[
Remaining = Target - Intake + ExerciseCredit
\]

其中：

```text
ExerciseCredit =
0                                  display_only
Exercise × 0.5                     eat_back_50
Exercise                           eat_back_100
```

UI 仍可单独展示“运动消耗”。

---

# 16. Macro Goal

用户可以手动设 g。

如果按能量百分比：

\[
Protein_g=\frac{TargetKcal\times P\%}{4}
\]

\[
Carb_g=\frac{TargetKcal\times C\%}{4}
\]

\[
Fat_g=\frac{TargetKcal\times F\%}{9}
\]

目标一旦生成，应保存具体 g snapshot，不应每次页面实时重算导致历史目标变化。

---

# 17. BMI

\[
BMI=\frac{weightKg}{heightM^2}
\]

仅作为信息指标。

体重趋势页显示：
- 当前 BMI；
- 与上一记录变化。

不要让 BMI 成为系统唯一目标。

---

# 18. Weight Trend

单日体重噪声很大。

V1 推荐：
- 原始点；
- 7 日 EWMA 或 rolling mean。

### EWMA

\[
S_t=\alpha X_t+(1-\alpha)S_{t-1}
\]

可设：

```text
alpha = 0.25
```

计算参数必须版本化。

UI：
- 浅色细点：原始体重；
- 主线：趋势体重。

---

# 19. Adaptive TDEE

目标：

利用一段时间实际：
- 平均摄入；
- 体重趋势变化；

反推实际维持热量。

近似：

\[
EnergyBalance \approx \frac{\Delta W \times 7700}{Days}
\]

如果体重下降：

\[
TDEE \approx AvgIntake + \frac{WeightLossKg \times 7700}{Days}
\]

如果体重增加：

\[
TDEE \approx AvgIntake - \frac{WeightGainKg \times 7700}{Days}
\]

### V1 窗口
推荐：
- 至少 21 天；
- 推荐 28 天；
- 必须有足够饮食记录；
- 必须有至少 8–10 个体重点。

### Confidence

简单 confidence 由：
- diary coverage；
- weight measurement count；
- time span；
- weight trend noise；

综合生成 0–1。

如果数据不足：
```text
estimated_tdee = null
reason = insufficient_data
```

---

# 20. Adaptive TDEE 稳定策略

不能每天剧烈跳动。

建议：
- 7 日才更新一次推荐值；
- 与旧 estimate 使用 smoothing；
- 变化大于某一阈值时只提示，不自动改 calorie target。

例如：

```text
newRecommendedTdee = 0.7*old + 0.3*rawEstimate
```

具体 smoothing 参数作为 method version 固定。

---

# 21. Daily Aggregation

全天：

```text
intake = sum diary_entry energy
protein = sum known protein
fat = sum known fat
carb = sum known carb
exercise = sum activity calorie
remaining = target - intake + exerciseCredit
```

每日 summary 需要同时带：

```text
food_entry_count
known_energy_entry_count
coverage
goal_snapshot
```

---

# 22. Rounding

内部计算：
- JS number；
- 保留至少 4 位计算；
- DB 可存 REAL。

展示：
- kcal：整数；
- macro g：1 位；
- micro mg：按营养素决定 1–2 位；
- body weight：1–2 位。

禁止每一个中间步骤都 round。

只在 display layer round。

---

# 23. 时间边界

“每日”按照用户 timezone。

例如：
```text
Asia/Shanghai
```

数据库 event 是 UTC，但 diary day 是：

```text
local_date = 2026-09-08
```

午夜切换不依赖服务器系统 timezone。

---

# 24. AI 分析输入

Nutrition Engine 输出 AI context：

```json
{
  "date": "2026-09-08",
  "targetKcal": 1934,
  "intakeKcal": 1680,
  "remainingKcal": 254,
  "protein": {"amount": 72, "target": 77},
  "fat": {"amount": 48, "target": 60},
  "carb": {"amount": 230, "target": 271},
  "coverage": {...}
}
```

AI 不重新算 kcal。

---

# 25. Golden Calculation Tests

至少固定：

### 份量
- 223 kcal/100g × 75g = 167.25

### ml
- density 0.91 × 5ml = 4.55g

### recipe
- 原料总 1000 kcal；
- 成品 500g；
- 200 kcal/100g。

### BMR
固定输入对照公式。

### MET
固定体重、MET、分钟对照。

### Unknown
一条 known + 一条 unknown：
- sum 只算 known；
- coverage < 1。

### Snapshot
修改 food nutrient 后旧 diary entry 不变化。

### Adaptive
28 天固定模拟数据得到确定输出。

---

# 26. Engine Version

统一：

```text
NUTRITION_ENGINE_VERSION=1
```

各算法：

```text
food_scale_v1
recipe_yield_v1
bmr_msj_v1
tdee_activity_factor_v1
activity_met_v1
weight_ewma_v1
adaptive_tdee_v1
```

只要公式行为变化就 bump version。

---

# 27. 安全边界

本系统是记录与分析工具，不做：
- 疾病诊断；
- 药物建议；
- 自动生成极端热量目标；
- 把 AI 输出当医学结论。

当用户手工输入异常目标时可以提示：
“该目标与当前估算差异较大，请确认。”
但允许用户覆盖。
