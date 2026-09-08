<!--
文档版本：v1.0
日期：2026-09-08
项目定位：个人自用、自托管 Docker 饮食/体重/运动/减脂管理应用
设计原则：Local-first / Single-user-first / Modular Monolith / Data Traceability / AI as Assistant
-->

# UI_DESIGN_SYSTEM.md

## 1. 设计目标

界面目标是复现用户给出的薄荷健康饮食页所体现的视觉语言，而不是套用常见“AI Dashboard”模板。

核心关键词：

> **轻、白、柔和、克制、大圆角、低阴影、薄荷绿色、清晰数字层级、移动端优先。**

禁止：
- 大面积渐变；
- 霓虹发光；
- 高饱和紫蓝；
- 玻璃拟态；
- 过多边框；
- 每张卡片都加阴影；
- AI 产品常见的深色科技风。

本系统是日常记录工具，视觉应该“安静”，而不是“炫技”。

---

# 2. 基准截图

用户提供截图原始尺寸约：

```text
930 × 2048 px
```

实际 UI 视觉可以按约 390 CSS px 宽手机进行还原。

推荐移动端基准：

```text
390 × 844 CSS px
```

同时测试：
- 360 × 800
- 393 × 852
- 430 × 932

截图中的核心特征：

1. 背景是极浅蓝灰而不是纯白；
2. 内容卡片纯白；
3. 页面左右留白约 15–16 CSS px；
4. 卡片大圆角约 22–26px；
5. 几乎不使用投影；
6. 绿色负责“状态”和“行动”，不负责所有文字；
7. 数字字号明显大于说明文字；
8. 食物列表行非常松；
9. 底部快捷操作固定；
10. 图标统一细线、圆角。

---

# 3. Design Tokens

建议全部写成 CSS variables。

```css
:root {
  --bg-page: #F5F6FA;
  --bg-surface: #FFFFFF;
  --bg-soft: #F0FBF7;
  --bg-selected: #C7F1E3;

  --primary: #38CF85;
  --primary-strong: #19B978;
  --primary-muted: #A8E8D1;

  --text-primary: #171A1F;
  --text-secondary: #7C8495;
  --text-tertiary: #AEB4C0;
  --text-disabled: #C6CBD4;

  --border-subtle: #EEF0F4;
  --track: #F0F2F6;

  --macro-carb: #8BD9BD;
  --macro-protein: #F29A9E;
  --macro-fat: #E7C85D;

  --danger: #E86767;
  --warning: #E9A94D;
  --info: #6B9FE8;

  --radius-card-mobile: 24px;
  --radius-card-desktop: 22px;
  --radius-button: 16px;
  --radius-control: 14px;
  --radius-chip: 999px;
}
```

这些颜色是基于截图视觉抽取后整理出的工程 token；正式开发时可通过截图叠图继续微调。

---

# 4. 字体

优先使用系统字体，不在 Docker 中捆绑字体文件。

```css
font-family:
  -apple-system,
  BlinkMacSystemFont,
  "PingFang SC",
  "Noto Sans CJK SC",
  "Microsoft YaHei",
  "Segoe UI",
  sans-serif;
```

### 字重

```text
400 regular
500 medium
600 semibold
700 bold
```

避免 800/900 过重。

---

# 5. Typography Scale

移动端：

| Token | 字号 | 行高 | 字重 | 用途 |
|---|---:|---:|---:|---|
| display-number | 34–38 | 1.05 | 700 | 剩余热量 |
| h1 | 24 | 32 | 700 | 页面标题 |
| h2 | 18 | 26 | 700 | 卡片标题 |
| h3 | 16 | 24 | 600 | 食物名 |
| body | 15 | 22 | 400 | 普通 |
| body-sm | 14 | 20 | 400 | 数量 |
| caption | 12 | 18 | 400 | 次级 |
| micro | 11 | 16 | 500 | source chip |

截图中的数字视觉非常重要：
- `1545` 必须是主视觉；
- `389`、`0` 是二级大数字；
- “推荐预算1934”必须弱化。

---

# 6. Spacing System

使用 4px 基线：

```text
4
8
12
16
20
24
32
40
48
```

默认页面：

```css
padding-inline: 16px;
```

卡片之间：

```text
12px mobile
16–20px desktop
```

卡片内部：

```text
16px compact
20px normal
24px large desktop
```

---

# 7. 手机总体布局

```text
┌──────────────────────────┐
│ status / top safe area   │
│ ←          今天       ⚙  │  56
│ 日 一 二 三 四 五 六      │  52
│                          │
│ [ 今日热量卡 ]            │
│                          │
│ [ 早餐卡 ]                │
│                          │
│ [ 午餐卡 ]                │
│                          │
│ [ 晚餐卡 ]                │
│                          │
│ [ 加餐卡 ]                │
│                          │
├──────────────────────────┤
│ +早餐 +午餐 +晚餐 +加餐 +运动 │ 72 + safe
└──────────────────────────┘
```

底部 quick bar 固定，但正文需要：

```css
padding-bottom: calc(88px + env(safe-area-inset-bottom));
```

---

# 8. 顶部 Header

移动端：

```text
height: 56px
page padding: 16px
```

### 返回按钮
- hit area 44×44
- icon 24
- stroke 2
- 不加背景

### “今天”胶囊
截图中它是非常浅的灰色 pill：

```text
height 38px
min-width 96px
border-radius 19px
background #F0F1F5
font 16/600
```

### 右侧操作
- 44×44 hit area
- icon 22–24
- 两按钮 gap 8

---

# 9. 星期选择器

高度：

```text
48–52px
```

7 等分。

普通：

```text
font-size 15
font-weight 600
color primary text
```

当前日：

```text
44×44
border-radius 14
background #C7F1E3
color #14B779
```

当前日期不使用实心深绿块，以保持截图的柔和感。

---

# 10. 首页热量卡

### Mobile

```text
width: calc(100vw - 32px)
min-height: 270px
border-radius: 24px
padding: 18px 16px 20px
background: white
box-shadow: none
```

可用极弱 shadow：
```css
box-shadow: 0 1px 2px rgba(19, 25, 38, 0.02);
```

### 标题

```text
“热量摄入”
font 18/700
margin-bottom 10
```

### 三列区域

```text
grid-template-columns: 1fr 1.45fr 1fr
align-items: center
```

左：
```text
饮食摄入
389
```

右：
```text
运动消耗
0
```

文字：
- label 13–14/600/secondary
- number 28/700/primary text

---

# 11. 热量环

移动端：

```text
diameter: 138px
stroke-width: 8px
```

SVG 自绘，不使用第三方 chart。

Track：
```text
#F2F3F6
```

Progress：
```text
#38CF85
```

stroke-linecap：
```text
round
```

环中央：

```text
还可以吃
1545
推荐预算 1934
```

层级：

```text
label       13/600 secondary
main number 36/700 #171A1F
budget      12/400 tertiary
```

进度：
```text
consumed / effectiveBudget
```

视觉环限制 0–100%；超标时环可变 danger，但数值仍显示负数 remaining。

---

# 12. Macro 三列

热量环下：

```text
display grid
grid-template-columns repeat(3,1fr)
gap 16
margin-top 20
```

每项：

```text
label 14/600
progress height 4px
track radius 2
value 12/400 tertiary
```

颜色：
- 碳水：mint；
- 蛋白质：soft coral；
- 脂肪：warm yellow。

示例：

```text
碳水化合物
────
62 / 271克
```

---

# 13. 今日饮食建议按钮

截图中的按钮属于“soft action”，不使用实心绿。

```text
height: 48px
margin-top: 18px
border-radius: 16px
border: 1px solid #B9E5D5
background: #F0FBF7
color: #1FB979
font: 16px / 600
```

左右：
```text
padding 16px
```

icon 18。

hover desktop：
```text
background #E9F9F3
```

active：
```text
transform: scale(.995)
```

---

# 14. 餐次卡

Mobile：

```text
width 100%
border-radius 24px
background white
padding 18px 16px 8px
```

### Header

```text
display flex
align-items baseline
height 34
```

左：

```text
早餐          建议484–677千卡
```

- 餐名 18/700
- 建议 13/400 tertiary

右：

```text
389 千卡 >
```

- kcal 14/500 primary green
- unit secondary
- chevron tertiary

---

# 15. 食物 Row

推荐：

```text
min-height: 78px
display: grid
grid-template-columns: 52px 1fr auto 20px
column-gap: 12px
align-items: center
```

### Thumbnail

截图食物图很小且背景干净。

```text
44×44
border-radius: 50% 或 12px
object-fit: cover
background: #FAFAFA
```

通用基础食材可使用圆形图；
包装商品使用 rounded 12。

### 名称

```text
food name: 16px / 600
amount: 13px / 400 / tertiary
gap: 2–4px
```

### kcal

```text
13px / 400 / tertiary
```

右箭头：
```text
18px
stroke 2.2
color #C4C9D2
```

不要给每行加分割线；用留白分隔更接近截图。

---

# 16. 餐卡行数与折叠

1–5 条：直接展示。

> 5 条：
- 默认展示前 5；
- 底部“查看全部 N 项”。

避免首页无限长。

---

# 17. 固定底部 Quick Add

截图中是五等分：

```text
+早餐
+午餐
+晚餐
+加餐
+运动
```

### 容器

```text
height: 72px + safe area
background: rgba(255,255,255,.96)
border-top: 1px solid #EFF1F4
backdrop-filter: blur(12px)
```

每个 action：

```text
min-width 64
icon 24
label 12–13 / 500
gap 4
```

点击：
- mobile 打开 bottom sheet；
- desktop 打开 modal/popover。

---

# 18. Bottom Sheet

手机添加食物的核心交互。

```text
width 100%
max-height 88vh
border-radius 24px 24px 0 0
background white
```

Handle：

```text
36×4
radius 2
#D8DCE4
margin 8 auto 10
```

Sheet Header：

```text
height 52
padding 0 16
```

---

# 19. 食物搜索页

顶部：

```text
Search Input 48px
radius 16px
background #F5F6F8
```

左 search icon。

输入后 Tab：

```text
最近 | 常用 | 食物库 | 我的 | 外部
```

chip 高度：
```text
32
```

结果行：
```text
64–72px
```

右侧显示：
```text
xxx kcal / 100g
```

选择后进入 quantity sheet，而不是直接一键写入，以防误记录。

---

# 20. 数量编辑器

核心控制：

```text
[-]  75  [+]
     克
```

数字：
```text
32/700
```

快捷 chip：

```text
50g
75g
100g
1个中等
```

底部确认：

```text
height 52
radius 16
background #38CF85
color white
font 16/600
```

这是少数可以使用实心绿的大按钮。

---

# 21. 食物详情

信息顺序：

1. 名称
2. 来源 chip
3. 每100g 热量 + P/F/C
4. serving
5. 完整营养表
6. 数据质量
7. 数据来源/version
8. 编辑（自定义食物）

不要一打开就显示几十个微量营养素。

---

# 22. 体重页面

手机：

```text
[ 当前体重卡 ]
[ 30天趋势图 ]
[ 周变化 / 月变化 ]
[ 历史记录 ]
```

### 当前体重卡

```text
radius 24
height ~150
```

主数字：
```text
55.0
kg
```

### Chart
- 主趋势绿色；
- 原始点浅灰；
- 不使用大片 gradient；
- grid line 极淡。

---

# 23. 分析页

Tab：

```text
7天
14天
30天
90天
```

卡片：
- 平均摄入；
- 目标命中；
- 宏量；
- 体重趋势；
- Adaptive TDEE；
- 记录完整度。

避免一次展示 15 张 KPI 小卡片。

---

# 24. AI 页面

AI 视觉必须继续融入健康 App，而不是变成 ChatGPT clone。

入口：

```text
今日饮食建议
AI 助手
```

聊天容器：
- 页面背景仍 #F5F6FA；
- 用户消息浅薄荷；
- AI 消息白卡；
- 建议 action 使用 soft mint。

### AI Proposal Card

例如：

```text
识别到：
馒头 约75g
鸡蛋 约50g
苹果 约80g

[修改] [确认加入早餐]
```

确认前不得写入。

---

# 25. Desktop Layout

桌面不放大手机页面。

### App Shell

>= 1024：

```text
sidebar: 220–232px
main: minmax(0, 1fr)
page max-width: 1240px
outer padding: 24–32px
```

Sidebar：
```text
background white
border-right #EEF0F4
```

Main：
```text
background #F5F6FA
```

---

# 26. Desktop Dashboard

推荐：

```text
┌────────────────────────────────────┐
│ 日期 / 今日                         │
├───────────────────┬────────────────┤
│ 今日热量大卡        │ 体重趋势        │
│                   │                │
├───────────────────┴────────────────┤
│ 早餐       │ 午餐                    │
├────────────┼────────────────────────┤
│ 晚餐       │ 加餐                    │
└────────────────────────────────────┘
```

CSS：

```text
top grid: 1.2fr 0.8fr
meal grid: repeat(2, 1fr)
gap: 20px
```

卡片 padding：
```text
24px
```

---

# 27. Desktop Card Size

Dashboard：
- calorie card min-height 300；
- weight card min-height 300；
- meal card min-height 240；
- analysis card min-height 180。

Desktop card radius：
```text
22px
```

不要使用 12px 企业后台式圆角。

---

# 28. Desktop Sidebar

宽：

```text
232px
```

logo/项目名区：
```text
height 72
padding 20
```

nav row：
```text
height 44
margin 4px 12px
padding 0 12
radius 12
```

selected：
```text
background #EAF9F3
color #19B978
```

图标：
```text
20
stroke 1.8
```

---

# 29. Dark Mode

V1 可预留，非必做。

如果实现，不要简单反色。

```text
page #111417
surface #191D21
surface2 #20252A
primary #46D795
text #F3F5F7
secondary #A4ABB5
```

但首版优先把 light mode 做到精致。

---

# 30. Motion

整体极克制。

```text
hover 120ms
sheet 220ms
modal 180ms
number update 150ms
```

Easing：

```text
cubic-bezier(.2,.8,.2,1)
```

禁止：
- 弹簧过冲；
- 发光；
- 数字不停滚动；
- 卡片浮动。

---

# 31. Accessibility

尽管追求视觉，必须：

- interactive hit area >= 44×44；
- 文字对比符合可读性；
- 不能只靠颜色表达 macro 状态；
- progress 有 aria；
- keyboard desktop 可操作；
- modal focus trap；
- reduced-motion。

---

# 32. Skeleton

首次加载：
- card skeleton；
- 不使用旋转 loading 占满页面。

Skeleton：
```text
#EEF0F3
shimmer 可不做
```

网络异常：
- 已缓存页面继续显示；
- 顶部小型 offline banner。

---

# 33. 空状态

薄荷风格应轻：

```text
今天还没有记录早餐
[ + 添加早餐 ]
```

不需要大型 AI 插图。

---

# 34. 页面密度

手机每屏只突出一个主任务。

首页：
- 热量；
- 餐食。

不要把：
- BMI；
- 水分；
- 睡眠；
- 运动；
- AI；
- 微量营养；
全部塞进首屏。

---

# 35. 组件清单

`packages/ui-tokens` + `apps/web/components`：

```text
AppShell
MobileTopBar
DesktopSidebar
WeekStrip
Card
CalorieRing
MacroProgress
MealCard
FoodRow
SoftActionButton
PrimaryButton
BottomQuickBar
BottomSheet
Modal
SearchField
SegmentedTabs
MetricNumber
SourceChip
QualityChip
AmountStepper
FoodNutrientTable
TrendChart
EmptyState
Toast
InlineError
AIProposalCard
```

---

# 36. CSS 约束

所有页面禁止随意硬编码新颜色。

只能通过：
- token；
- component variant。

卡片 radius 只允许：
```text
16
20
22
24
```

禁止不同页面随意出现：
```text
17px / 19px / 27px / 31px
```

---

# 37. Screenshot Regression

UI 要接近截图，必须使用视觉回归。

Playwright 固定 viewport：

```text
390×844
430×932
1024×768
1440×900
```

关键页面截图：
- dashboard empty；
- dashboard populated；
- add food；
- search；
- quantity；
- weight；
- analytics；
- AI proposal。

像素 diff 不要求 0%，但 layout shift 必须受控。

---

# 38. 对薄荷健康的借鉴边界

自用场景可以非常接近：
- 卡片比例；
- 背景层级；
- 热量环；
- 星期条；
- 食物列表；
- 底部快捷栏；
- 字号层级。

建议自建：
- App 名称；
- Logo；
- 图标细节；
- 食物缩略图；
- AI 图标；
- 桌面布局。

这样既获得你喜欢的视觉体验，也避免未来维护被第三方素材绑住。

---

# 39. 最终视觉验收

手机 Dashboard 满足以下标准才算通过：

1. 背景不是纯白；
2. 白卡与背景只靠轻色差分层；
3. 大圆角一致；
4. 热量数字是第一视觉焦点；
5. 绿色占比克制；
6. 食物行没有厚分隔线；
7. 底部快捷栏不遮正文；
8. 390px 宽不横向溢出；
9. 360px 宽仍可用；
10. 1440px 桌面不是“巨大的手机页面”。

