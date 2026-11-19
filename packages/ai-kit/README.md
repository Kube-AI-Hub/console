# @kube-ai-hub/ai-kit

Console 的界面库：基础组件 + 列表 / 详情 / 表单三类 schema。

采用 [Apache License 2.0](./LICENSE) 开源发布。第三方来源与修改记录见 [NOTICE](./NOTICE)：
图标 sprite 派生自 `@kube-design/components`（MIT，Copyright (c) 2020 KubeSphere）。

## 为什么另起一个库

`@kube-design/components` 本身是 MIT，替换它的原因不是许可证，而是技术栈：

- 基于 class 组件 + `@babel/runtime` + bulma + scss，无法承载 React 19 与 Tailwind
- 29 个组件只覆盖基础控件，没有 schema 层；console 靠 `withList` HOC（324 行，76 个页面复用）承担列表样板
- 没有主题切换能力：console 只有暗色一套

本库的目标是把「页面长什么样」从「每个页面各写一遍」变成「声明一份 schema」。

## 契约（写代码前先读）

### 1. 组件只消费语义 token

`src/styles/tokens.css` 分两层：

- **原始层** `--ai-raw-*`：与 `console/src/scss/variables.scss` 一一对应的色阶
- **语义层** `--ai-*`：`--ai-bg`、`--ai-fg`、`--ai-accent`、`--ai-line`…

组件**只能**用语义层。原始层只在需要精确色阶时使用（图表、状态点）。这样换肤只需要改语义层。

#### token 值必须是空格分隔的通道三元组

```css
--ai-bg: 20 33 90;      /* 正确 */
--ai-bg: 20, 33, 90;    /* 错误：逗号分隔 */
--ai-bg: #14215a;       /* 错误：hex */
```

**为什么这条不能破**：Tailwind 的透明度和颜色工具类生成的是现代语法
`rgb(var(--ai-bg) / <alpha>)`，它要求通道以空格分隔。逗号分隔或 hex 会让整个
声明失效，浏览器回退成黑色 —— 页面布局完全正常，只是**整个调色板消失**，
看上去像「设计还没做完」而不是「CSS 坏了」。

`test/tokens.test.ts` 会在构建前拦住这三种写法。

### 2. 主题是两个正交维度

| 属性 | 取值 | 作用 |
|---|---|---|
| `data-theme` | `dark` / `light` | 明暗模式 |
| `data-accent` | `violet` / `green` | 主色配色方案 |

两者组合出四种外观。`violet` 是 console 现有主色（SCSS 里叫 `$green-color03`，是历史命名错误，实际 `#a981f8`）；`green` 是 Kube AI Hub 的品牌绿（`#39E5B8`）。

**每套配色都有自己的完整外壳**，不只是换主色：

| 配色 | 模式 | 页面背景 | 卡片面 | 边框 |
|---|---|---|---|---|
| violet | dark | `#0b184d` | `#2c3a7c` | `#3e4c92` |
| green | dark | `#00151c` | `#001e28` | `#1c4552` |
| violet | light | `#f7f6fa` | `#fefefe` | `#d1c6e9` |
| green | light | `#f6fafa` | `#fefefe` | `#c6e5e9` |

**violet = console 线上原貌**：背景走 `$light-color01..04`（`#0b184d` → `#2c3a7c`，色相 229° 蓝紫），主色 `$primary #a981f8`。

**green = dataelem 原貌**：背景用其 `--deep-0..2` 与 `--abyss`（`#00151C` / `#001E28` / `#0A3D4D` / `#002E3C`，色相 186° 青绿），主色品牌薄荷 `#39E5B8`。

两套色相的差别是刻意的：紫配色的页面必须落在蓝紫区（210°–250°），绿配色落在青绿区。混用会让主题「变色」。

实测正文对比度：violet-dark 13.8:1、green-dark 15.4:1，均超 WCAG AAA。

**每个配色块必须覆盖完整的 13 个外壳 token**（背景 4 个、表面 3 个、边框 2 个、表头、行悬停、导航、主色）。漏掉任何一个，就会出现「紫底配蓝边」这种割裂感，由 `test/tokens.test.ts` 逐块校验，并用色相断言锁住紫配色的色相区间。

主题写在 `<html>` 上而不是 Provider 容器上，否则 portal 出去的弹窗、菜单拿不到变量。

首屏防闪烁用 `themeBootstrapScript` 内联到 HTML `<head>`：

```ts
import { themeBootstrapScript } from '@kube-ai-hub/ai-kit';
// <script dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
```

### 3. 动效必须降级

所有 hover 效果包在 `@media (hover: hover) and (pointer: fine)` 内 —— 触摸屏上 `:hover` 会在点击后粘住。所有动画在 `prefers-reduced-motion: reduce` 下退化为静态。动效只改 `transform` / `opacity`，不改布局属性。

### 4. 组件不内置 i18n

文案一律走 props。库不知道宿主用 i18next 还是别的方案。

### 5. 领域类型用注册表扩展

GPU 数量、RDMA 设备这类 console 特有字段通过 `registerFieldType` / `registerColumnType` 注册，不改库。

## 目录

```
src/
├── styles/        tokens.css（双层 token）、motion.css（动效类）
├── theme/         ThemeProvider（mode + accent）、ThemeToggle / AccentToggle
├── motion/        useSpotlight、Reveal、ParticleField、StreamText
├── primitives/    基础组件
├── schema/        ResourceList / ResourceDetail / ResourceForm + 注册表
├── editor/        YamlEditor（CodeMirror 6，懒加载）+ k8s 字段补全
├── terminal/      TerminalView（xterm，懒加载）
├── charts.ts      子路径入口：DonutChart
├── terminal.ts    子路径入口：TerminalView
└── utils/         cn()、useMediaQuery
```

### 基础组件清单

| 类别 | 组件 |
|---|---|
| 表单 | Button / Input（含 `InputSearch`）/ Textarea / Select（含 `MultiSelect`）/ Checkbox / RadioGroup（及别名 Radio）/ Switch / Slider / InputNumber / DatePicker / FormField / Label / AutoComplete / PasswordStrengthMeter |
| 表单容器 | Form / Form.Item / Form.Group（声明式，兼容 `async-validator` 规则） |
| 展示 | Badge / Tag / Avatar / Card（+Header/Title/Description/Content）/ Panel / Text / Divider / Skeleton / Progress / Empty / DescriptionList（+DescriptionItem）/ MetricCell / StatisticsGroup / MetricRing / Icon（366 个） |
| 状态 | RefreshVeil（重取遮罩，全站唯一实现）/ ChartSkeleton（图表首屏骨架）——见「加载态与刷新态」 |
| 反馈 | Alert / Loading / Modal / Drawer / Tooltip / Popover / Toast（Provider + useToast）/ Notify（命令式） |
| 导航 | Tabs（`aiId` / 徽标 / 内容面板）/ Menu（支持折叠态）/ Breadcrumb / Dropdown / Pagination / Accordion / Collapse |
| 布局 | Columns / Column / Level / LevelLeft / LevelRight / LevelItem |
| 数据 | Table（排序 / 固定首末列 / 列提示）/ Tree |
| 图表 | TrendChart / DonutChart（`@kube-ai-hub/ai-kit/charts` 子路径，按需引入） |
| 编辑器 | YamlEditor（`@kube-ai-hub/ai-kit` barrel 导出，CodeMirror 内部懒加载） |
| 终端 | TerminalView（`@kube-ai-hub/ai-kit/terminal` 子路径） |

### 与 kube-design 的对照

`@kube-design/components` 的 28 个组件已覆盖 27 个：

| kube-design | ai-kit | 说明 |
|---|---|---|
| Alert / Badge / Button / Checkbox / DatePicker / Dropdown / Input / Loading / Menu / Pagination / Progress / Radio / Select / Slider / Table / Tabs / Tag / TextArea / Toggle / Tooltip / Collapse | 同名或等价组件 | `Toggle`→`Switch`，`TextArea`→`Textarea`，`Radio`→`RadioGroup`（保留 `Radio` 别名） |
| Icon | Icon | 迁移完整 sprite，366 个唯一图标（上游有 4 个重复 id） |
| Layout | Columns / Column / Level* | 拆成具名导出，与上游一致 |
| Form | Form / Form.Item / Form.Group | 保留声明式 API，规则格式兼容 |
| Notify | Notify | 保留命令式 API（`info/success/warning/error/open/close/clear`） |
| Popper | Popover | 底层能力，语义化重命名 |
| AutoComplete | AutoComplete | 完整重写，含键盘导航与 `aria-activedescendant` |
| LocaleProvider | — | 刻意不做：库不内置 i18n，文案走 props |

kube-design 里没有、迁移中从应用层上收的组件：

| 组件 | 来源 | 为什么上收 |
| --- | --- | --- |
| `DescriptionList` / `DescriptionItem` | 用户设置与全部详情页的只读信息行（应用内 `DefinitionRow`，24 处调用） | 同一结构在多个页面出现颜色/换行漂移；语义应是 `<dl>/<dt>/<dd>` 而不是自定 div |
| `PasswordStrengthMeter` | 用户设置弹窗与创建用户弹窗共用的密码强度面板 | 面板是纯展示，规则判定与文案在应用层；展示与无障碍语义应只有一份 |

Storybook 侧补齐 kube-design 的 `Foundation`（Colors / Icons）与 `Components` 分类，并额外提供 `Schema` 分类（列表 / 详情 / 表单 / ConfigMaps 移植）。

## 加载态与刷新态

每个「会等待」的区域只有两种画面，且各只有一份实现。写新页面时从这里抄接线，不要自己拼。

| 场景 | 用什么 | 用户看到 |
| --- | --- | --- |
| 列表首次加载 / 翻页 / 改排序 | `ResourceList` 的 `loading` | 骨架行 |
| 列表重取（刷新、改筛选） | `ResourceList` 的 `refreshing`（`useListRefresh(...).refreshing`） | 保留行 + `RefreshVeil` + `aria-busy` |
| 图表首次加载 | `ChartPanel` 的 `state="loading"` | `ChartSkeleton`：轴刻度条 + 三条脉冲带 + 基线 |
| 图表手动刷新 | `ChartPanel` 的 `state="refreshing"` + `manualRefresh` | 保留曲线、降到 70% + `RefreshVeil` |
| 图表自动刷新 | 同上，`manualRefresh={false}` | 无遮罩，曲线平滑过渡 |
| 只有一块图、不带窗口控件 | `TimeSeriesChart` 的 `refreshing` | 同款 `RefreshVeil`，句柄 `<chartAiId>:refreshing` |

### 为什么必须是同一个组件

两条重复出现过的缺陷：

- **遮罩漂了三份**：表格 40% 底色、图表 45% 且带圆角、`z-10` vs `z-30`。同一个刷新动作在不同页看起来像两个功能。
- **骨架叠在图表上方**：`ChartPanel` 同时渲染骨架和图表，骨架在文档流里，220px 的面板首屏量出 468px，下面还露着空坐标轴。
  骨架要**代替**图表占位，不是加在上面。

所以 `RefreshVeil`（遮罩）与 `ChartSkeleton`（骨架）由本库提供，页面与其它共享组件只引用。页面里出现
`backdrop-blur-[1px]`、`animate-pulse rounded-ai-md bg-ai-surface-2` 或写死的 `'更新中…'`，
`kube-frontend/config/loading-refresh-contract.test.ts` 会失败。

### 两个 prop 不能混用

`loading` 与 `refreshing` 回答的是两个问题：

- `loading`：**还没有东西可显示**（首屏、翻页）。行列换成骨架。
- `refreshing`：**已经有内容，正在换**。内容留在屏幕上并压低，遮罩告诉读者数据在更新。

`loading={isFetching}` 是最常见的错：每次重取都闪骨架，而遮罩永远不会出现——慢响应看起来像按钮坏了。
首屏用 `isPending`，刷新用 `isFetching && !isPending`；`useListRefresh` 已经算好，直接用它的返回值。

### 自动刷新不遮

遮罩只代表「人点了」。轮询页要把手动信号与 `isFetching` 分开：集群概览用 `refresh.manual`，
集群监控页用 `manualTick`，图表面板自己刷新时用局部的 `ownRefresh`。
把 `manualRefresh` 接到 `query.isFetching` 上，会让每 15 秒闪一次——比没有反馈更糟。

```tsx
// 图表：首屏骨架 → 手动刷新遮罩 → 自动刷新安静更新
<ChartPanel
  aiId="cluster-monitor:gpu"
  state={query.isPending ? 'loading' : query.isError ? 'error' : query.isFetching ? 'refreshing' : 'ready'}
  manualRefresh={isManualRefresh}   // 只来自读者，不来自定时器
  onRefresh={refreshNow}
  range={range}
  onRangeChange={setRange}
  start={start}          // 宿主查询实际用的区间，见下一节
  end={end}
  step={step}
  labels={labels}
  series={series}
/>
```

```tsx
// 列表：三件套来自同一个 hook，不能只接一半
const listRefresh = useListRefresh('pods', query);
<ResourceList
  loading={state === 'loading'}
  refreshing={listRefresh.refreshing}
  onRefresh={listRefresh.onRefresh}
  ...
/>
```

### 核对的不是「有没有加载组件」

首屏与刷新各截一张，量容器高度：骨架与图表必须同一个高度。再确认遮罩出现时内容还在、图例仍可读。
`data-ai-id` 的句柄约定：表格是 `table:refreshing`，面板是 `<aiId>:refreshing`，骨架是 `<aiId>:loading`。

## 三类 schema

### 列表

```tsx
const schema: ListSchema<Pod> = {
  rowKey: 'name',
  columns: [
    // 固定在左侧：横向滚动时读者靠它认行。
    { key: 'name', title: '名称', type: 'link', width: 180, pin: 'start' },
    { key: 'status', title: '状态', type: 'status' },
    { key: 'restarts', title: '重启', type: 'number', align: 'right' },
    // 表头旁的信息按钮，说明口径；不是 title 属性（键盘可达）。
    { key: 'cpu', title: 'CPU', hint: '实时利用率；已分配为调度器口径' },
  ],
  search: { placeholder: '按名称搜索' },
  filters: [
    { key: 'status', title: '状态', options: [...] },
    // 多选 + 可搜索：选项长到需要打字时用。
    { key: 'vendor', title: '厂商', multiple: true, searchable: true, options: [...] },
    { key: 'model', title: '型号', type: 'text' },
  ],
  sortableKeys: ['name', 'status'],
  columnVisibility: { label: '显示列', resetLabel: '恢复默认列' },
  refresh: { label: '刷新' },
  primaryAction: { key: 'create', label: '创建' },
  selection: 'multiple',
  actions: [{ key: 'delete', label: '删除', tone: 'danger', confirm: '确认删除？' }],
  rowActions: [{ key: 'delete', label: '删除', tone: 'danger', confirm: '确认删除？' }],
};

<ResourceList schema={schema} rows={rows} onAction={(key, row) => ...} />
```

排序、筛选、列显隐、分页都由宿主持有状态（列表通常服务端分页，客户端排序会得到跨页错误的顺序），`ResourceList` 只报告请求。

**固定列只支持首末各一列**，且不可隐藏 —— 它是定位行的锚点。选择框列与 `rowActions` 列自动固定，页面只需声明左侧那一列。细节见 `design/kube-frontend/cluster-management/nodes.md` 的 `DEC-...-16`。

### 详情

```tsx
const schema: DetailSchema<Node> = {
  header: {
    title: (row) => row.name,
    status: (row) => ({ label: row.status, tone: 'success' }),
  },
  stats: [{ key: 'cpu', label: 'CPU', value: (row) => row.cpu }],
  sections: [
    { id: 'basic', title: '基本信息', fields: [{ key: 'ip', label: '内网 IP' }] },
    { id: 'gpu', title: 'GPU', render: (row) => <GpuTable data={row.gpus} /> },
  ],
};

<ResourceDetail schema={schema} data={node} />
```

### 表单

```tsx
const schema: FormSchema<WorkloadForm> = {
  layout: { columns: 2 },
  fields: [
    { key: 'name', label: '名称', type: 'text', required: true },
    { key: 'replicas', label: '副本数', type: 'number', min: 1 },
    { key: 'labels', label: '注解', type: 'key-value', wide: true },
  ],
};

<ResourceForm schema={schema} defaultValues={...} onSubmit={...} />
```

支持字段类型：`text` / `password` / `textarea` / `number` / `select` / `radio` / `checkbox` / `switch` / `slider` / `date` / `tags` / `key-value`，以及注册的自定义类型。

## 开发

```bash
pnpm install                     # 库目录内独立安装（.npmrc 已设 node-linker=hoisted）
pnpm typecheck
pnpm test
pnpm storybook                   # 组件与 schema 的可视化验证，6106
pnpm build                       # 输出 dist/（ESM + d.ts + styles.css）
```

### Storybook 侧的约定

侧栏由 `.storybook/preview.tsx` 的 `storySort` 排序：分类固定为 Foundation / Components /
Schema / Primitives，**分类内部按字母排序**。新增组件时：

1. 新建 `stories/<ComponentName>.stories.tsx`，`meta.title` 写成
   `Components/<ComponentName>`（与组件同名，不加序号或前缀）；
2. 不用改排序配置——`method: 'alphabetical'` 会把它放进正确的位置。

**不要**在 `storySort.order` 里维护组件名单：名单不会随着新组件更新，新组件会掉到列表
末尾（`DescriptionList` 与 `PasswordStrength` 就这样排到过 `Tree` 后面）。只有新增
**分类**时才更新 `order`，并同步 `test/storybook-order.test.ts` 的 `SECTIONS`。

`pnpm test` 里的 `storybook-order` 检查守住四件事：排序必须是 `method: 'alphabetical'`
且 `order` 里不能有嵌套名单；每条 story 的标题必须落在已知分类下；标题不能重复；
story 文件仍由 glob 自动发现。文件内 story 的先后顺序仍是手写顺序。

## 消费方接入

Console 不安装本包的发布产物，而是通过 Vite alias **直接引用 `src/` 源码**：

```ts
// kube-frontend/apps/console-next/vite.config.ts
{ find: /^@kube-ai-hub\/ai-kit$/,          replacement: '…/packages/ai-kit/src/index.ts' }
{ find: /^@kube-ai-hub\/ai-kit\/charts$/,  replacement: '…/packages/ai-kit/src/charts.ts' }
{ find: /^@kube-ai-hub\/ai-kit\/terminal$/, replacement: '…/packages/ai-kit/src/terminal.ts' }
{ find: /^@kube-ai-hub\/ai-kit\/styles\.css$/, replacement: '…/packages/ai-kit/src/styles/tokens.css' }
```

**为什么不用 `dist`**：本包有独立的 `node_modules`（Storybook 需要），其中的 `react` 是
React 18；加载 `dist` 会让组件跑在那份 React 上，hooks 抛 `Invalid hook call`。指向源码
则由宿主的打包器解析，`vite.config.ts` 的 `resolve.dedupe` 再把 `react` / `react-dom` 钉到
宿主那一份。

### 页面实际 import 的是 `@kube-ai-hub/ui`

`kube-frontend/packages/ui` 是 console 的展示层入口，它把本包再导出，并补上应用侧约定
（无状态管理、无请求、无 i18n、无路由）。页面写 `@kube-ai-hub/ui`，不直接写
`@kube-ai-hub/ai-kit`。

它的子路径决定「哪些模块能离开首屏」：

| 子路径 | 转发到 | 为什么单独开一个入口 |
| --- | --- | --- |
| `@kube-ai-hub/ui` | ai-kit barrel | 每个页面都 import，进 `app-shared` chunk |
| `@kube-ai-hub/ui/editor` | `YamlEditor` | CodeMirror 188 KB gzip，只有弹窗需要 |
| `@kube-ai-hub/ui/charts` | `DonutChart` | recharts，只有图表页需要 |
| `@kube-ai-hub/ui/terminal` | 终端组件 | xterm，只有终端弹窗需要 |

**给本包加导出时注意**：新增到 barrel 就等于新增到每个页面的首屏。重依赖（编辑器、
图表库、终端）必须走子路径。

`tailwind.preset` 由宿主的 Tailwind 配置引入：

```js
// tailwind.config.js
presets: [require('@kube-ai-hub/ai-kit/tailwind.preset')]
```

## 明确不做

- 不做 SSR（console 是 SPA）
- 不内置 i18n（文案走 props）
- 不引入状态管理库（库是纯展示 + schema 渲染）
- 不做 schema 的「远端加载」（JSON 存后端），只做本地 TS 配置对象

## 许可证

Copyright 2026 Kube AI Hub.

以 [Apache License, Version 2.0](./LICENSE) 授权。你可以自由使用、修改与再分发，包括商业用途，条件是保留版权与许可声明、在修改过的文件中标注变更，并按需附带 NOTICE 文件。

`package.json` 中的 `license` 字段与本文件一致，均为 `Apache-2.0`。
