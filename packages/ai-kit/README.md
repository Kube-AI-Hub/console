# @kube-ai-hub/ai-kit

Console 的新界面库。替代 `@kube-design/components`，并补上「列表 / 详情 / 表单」三类 schema 驱动的公共组件。

采用 [Apache License 2.0](./LICENSE) 开源发布。本包单独授权，不随仓库根目录的 AGPL-3.0 传播；引用本库的下游项目只需遵守 Apache 2.0 的署名与 NOTICE 义务。

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
--ai-bg: 20 33 90;      /* 正确：249 251 253 */
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

**violet = console 线上原貌**：背景走 `$light-color01..04`（`#0b184d` → `#2c3a7c`，色相 229° 蓝紫），主色 `$primary #a981f8`。这两个值已对照线上 CSS 核实（`#a981f8` 出现 55 次、`#14215a` 44 次）。

**green = dataelem 原貌**：背景用其 `--deep-0..2` 与 `--abyss`（`#00151C` / `#001E28` / `#0A3D4D` / `#002E3C`，色相 186° 青绿），主色品牌薄荷 `#39E5B8`。

两套色相的差别是刻意的：紫配色的页面必须落在蓝紫区（210°–250°），绿配色落在青绿区。混用会让主题「变色」—— 例如把 dataelem 的青黑底套到紫色主题上，页面会明显偏绿。

实测正文对比度：violet-dark 13.8:1、green-dark 15.4:1，均超 WCAG AAA。

**每个配色块必须覆盖完整的 13 个外壳 token**（背景 4 个、表面 3 个、边框 2 个、表头、行悬停、导航、主色）。漏掉任何一个，就会出现「紫底配蓝边」这种割裂感 —— 这正是深色模式最初的缺陷，现在由 `test/tokens.test.ts` 逐块校验，并用色相断言锁住紫配色的色相区间。

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
├── primitives/    33 个基础组件
├── schema/        ResourceList / ResourceDetail / ResourceForm + 注册表
└── utils/         cn()
```

### 基础组件清单

| 类别 | 组件 |
|---|---|
| 表单 | Button / Input / Textarea / Select / Checkbox / RadioGroup（及别名 Radio）/ Switch / Slider / InputNumber / DatePicker / FormField / Label / AutoComplete |
| 表单容器 | Form / Form.Item / Form.Group（声明式，兼容 `async-validator` 规则） |
| 展示 | Badge / Tag / Avatar / Card（+Header/Title/Description/Content）/ Panel / Text / Divider / Skeleton / Progress / Empty / Icon（366 个） |
| 反馈 | Alert / Loading / Modal / Drawer / Tooltip / Popover / Toast（Provider + useToast）/ Notify（命令式） |
| 导航 | Tabs / Menu（支持折叠态）/ Breadcrumb / Dropdown / Pagination / Accordion / Collapse |
| 布局 | Columns / Column / Level / LevelLeft / LevelRight / LevelItem |
| 数据 | Table / Tree |

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

Storybook 侧补齐 kube-design 的 `Foundation`（Colors / Icons）与 `Components` 分类，并额外提供 `Schema` 分类（列表 / 详情 / 表单 / ConfigMaps 移植）。

## 三类 schema

### 列表

```tsx
const schema: ListSchema<Pod> = {
  rowKey: 'name',
  columns: [
    { key: 'name', title: '名称', type: 'link' },
    { key: 'status', title: '状态', type: 'status' },
    { key: 'restarts', title: '重启', type: 'number', align: 'right' },
  ],
  search: { placeholder: '按名称搜索' },
  rowActions: [{ key: 'delete', label: '删除', tone: 'danger', confirm: '确认删除？' }],
};

<ResourceList schema={schema} rows={rows} onAction={(key, row) => ...} />
```

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
npm install --legacy-peer-deps   # 库目录内独立安装
npm run typecheck
npm test
npm run storybook                # 组件与 schema 的可视化验证
npm run build                    # 输出 dist/（ESM + d.ts + styles.css）
```

## 消费方接入

```js
// tailwind.config.js
presets: [require('@kube-ai-hub/ai-kit/tailwind.preset')]
```

```ts
// 入口
import '@kube-ai-hub/ai-kit/styles.css';
import { ThemeProvider } from '@kube-ai-hub/ai-kit';
```

库以 ESM 形式发布，React / Radix 作为外部依赖由宿主的打包器解析，避免出现两份 React。

## 验证结果（2026-11-09）

| 项 | 结果 |
|---|---|
| `tsc --noEmit`（strict 全开） | 0 错误 |
| `vitest run` | 63 通过 / 63 |
| `vite build` | `index.js` 126 KB、`sprite` 独立 chunk 333 KB（按需加载）、`styles.css` 25.5 KB |
| Storybook | 全部 story 无编译错误 |

组件级核对（DOM 与计算样式实测）：

| 项 | 结果 |
|---|---|
| 四种主题组合 | 背景/边框全部跟随配色 |
| 深色背景对比度 | violet 13.8:1、green 15.4:1（均超 WCAG AAA） |
| violet 深色色相 | 实测 228°（蓝紫区），与 console 线上一致 |
| Icon | 366 个图标全部渲染，`<use>` 引用正确 |
| Icon 几何 | sprite 光栅化后 4154/9216 不透明像素，图形正常 |
| 表头与边框 | 四种组合下均解析为主题色，无残留灰色 |
| 列表/详情/表单 schema | 搜索、选择、分页、字段校验、条件字段均可用 |

**截图验收受阻**：本次会话后期浏览器截图工具持续返回空帧（DOM 内容、几何、计算样式、SVG 光栅化像素均正常，仅截图输出为空白）。已改用 DOM 度量与 canvas 像素采样完成验证；截图工具恢复后应补一次视觉回归。

### 验证中发现并修复的缺陷

1. **整个调色板变黑白（最严重）**：token 值写成 `249, 251, 253`（逗号分隔），而 Tailwind 生成的 `rgb(var(--ai-bg) / 1)` 是现代语法，要求空格分隔。声明整条失效 → 浏览器回退黑色。页面布局完全正常，所以从界面看不出是 CSS 坏了。已全部改为 `249 251 253`，并加 `test/tokens.test.ts` 守住。
2. **Tailwind preset 静默失效**：`tailwind.config.cjs` 用 `require()` 加载 ES module，拿到 `{ default }` 包装，Tailwind 收到空 preset 且不报错。改为取 `.default`。
3. **violet 暗色漏色**：`[data-accent='violet']` 缺 `[data-theme]` 限定，与浅色规则同优先级，暗色拿到 `#6b29fa`（应为 `#a981f8`）。四色组合现在各带主题限定。
4. **深色边框未跟随配色**：两套深色块只覆盖了表面色，漏了 `--ai-line` / `--ai-line-strong`，导致紫底配蓝边。已补齐，并加测试逐块校验 13 个外壳 token。
5. **浅色外壳几乎无差别**：初版浅色 tint 饱和度过低（`#fbfafd` vs `#fafcfd`），两套配色肉眼无法区分。重新按亮度曲线生成，边框色也一并带上主题色。
6. **紫色主题偏绿**：为增加深色层次时，把 dataelem 的青黑底（`#00151C`，色相 186°）误用到紫色主题，导致紫蓝页面发绿。改回 console 原生 `#0b184d`（色相 228°），并加色相断言：violet 的 `--ai-bg` 必须落在 210°–250° 区间，且不得引用 `abyss` 色阶。
6. **Story 标题重复渲染**：story 与 preview decorator 各包了一层 `ai-root` 和标题。改为 decorator 独占页面外壳。
7. **`hideBelow` 声明未使用**：列级响应式隐藏没有传到 `Table`。补了 `TableColumn.className` 并接入。

### 环境说明

- 本机 `~/.npmrc` 指向国内镜像，本次安装显式使用 `--registry=https://registry.npmjs.org`，未修改全局配置。
- pnpm 在 workspace 子目录解析 Storybook 的 peer 链会失败（`@storybook/addon-docs` 找不到），库内 `.npmrc` 设 `node-linker=hoisted` 解决。

## 明确不做

- 不修改 console 应用任何现有代码（库独立演进）
- 不做 SSR（console 是 SPA）
- 不内置 i18n（文案走 props）
- 不引入状态管理库（库是纯展示 + schema 渲染）
- 第一阶段不做 schema 的「远端加载」（JSON 存后端），只做本地 TS 配置对象

## 许可证

Copyright 2026 Kube AI Hub.

以 [Apache License, Version 2.0](./LICENSE) 授权。你可以自由使用、修改与再分发，包括商业用途，条件是保留版权与许可声明、在修改过的文件中标注变更，并按需附带 NOTICE 文件。

本包是独立授权的组件：它不继承本仓库根目录 `LICENSE` 的 AGPL-3.0。把 ai-kit 引入其他项目、产品或服务时，只需满足 Apache 2.0 的义务。

`package.json` 中的 `license` 字段与本文件一致，均为 `Apache-2.0`。

