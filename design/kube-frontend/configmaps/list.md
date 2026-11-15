# 配置字典列表 · 技术方案（L3）

> 承接 [`prd/kube-frontend/configmaps/list.md`](../../../prd/kube-frontend/configmaps/list.md)。

## 概述

本文件说明该功能点的实现方式与取舍，不复述需求。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01`
- AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-10
- AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-09
- AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-08
- AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-07
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-05`
- `AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-06`
## 设计目标与非目标

**目标**：行为可预测、失败可解释、实现可被架构测试约束。

**非目标**：不做与需求「明确不做」条目相冲突的能力。

## 关键约束

- 状态与文案分离：组件只接收 props，文案来自 `packages/locales`。
- 所有可交互元素经 `AiButton` / `actionProps`，保证 `data-ai-id` 不缺失。
- 键列截断到 50 个字符，按码点而非 UTF-16 单元计数。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01 — 简化排序状态

**为什么**：用两个 useState（sortBy / order）而不是一个对象。列头只需要知道「是不是我」和「方向」，两个值足够，也不需要担心对象引用变化触发多余渲染。

**被否方案**：把排序塞进 URL query：便于分享，但本期路由未做搜索参数序列化，先不放。

**何时重新考虑**：需要分享排序后的链接时


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02 — 列定义放组件内

**为什么**：列数组在页面组件里就地定义，类型由 `TableColumn<ConfigMapSummary>` 约束。抽出去会让「这个资源有哪些列」与「这个页面怎么展示」分离，首期两种需求还没出现分化。

**被否方案**：立刻抽成通用 `resourceColumns` 注册表：在没有第二个使用者前属于提前抽象。

**何时重新考虑**：第二个资源模块出现、且列结构重复时


### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-08 — 每页条数是状态，不是常量

旧 console 的分页组件带 `PAGESIZE_OPTION = [10, 20, 50, 100]`；新 UI 第一版把每页条数写成 `const PAGE_SIZE = 10`，
读者只能 10 条一页地翻。本批把它接回列表状态：`useResourceListState` 本来就有 `pageSize/setPageSize`，
缺的是页面把它传给请求与分页器。

`toListParams(state, base)` 的第三个参数改为可选：省略时跟随 `state.pageSize`。保留这个重载是为了不改动
那些「故意固定页大小」的页面（例如面板里的 TopN 表格），同时让带选择器的页面不必再传常量——传常量正是
「表格说 50 条、请求只要 10 条」这个 bug 的来源。

### CON-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-08 — 分页请求参数

`GET …/configmaps?page=<n>&limit=<pageSize>&sortBy=<key>&ascending=<bool>`；切换每页条数时 `page` 回到 1。
共享 ResourceList 只有在同时给出 `pagination.pageSizeOptions` 与 `onPageSizeChange` 时才渲染选择器。

### GOT-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-08 — 只加 pageSizeOptions 不会出现选择器

`ResourceList` 要求两个 prop 同时在位；只声明 `pageSizeOptions` 时选择器不渲染、页面看起来「没接上」，
而类型检查不会报错。用 `data-ai-id="<前缀>:page-size"` 断言控件存在并可用，而不是只看请求。
### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-09 — 客户端分页列表的切片与页大小同源

合并多来源或一次取全量的列表（告警策略、联邦项目、存储类）在本地分页。给它们接档位时，
「分页器显示的 pageSize」与「切片用的 pageSize」必须是同一个值：告警策略此前切片用常量 `PAGE_SIZE`，
选择器改成 50 后分页器说 50、表格仍只切 10 行。切片一律用 `list.pageSize`。

### GOT-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-09 — 服务端分页列表的三处必须同时改

一个服务端分页列表要真正支持档位，需要三处一致：请求参数 `pageSize: list.pageSize`、查询键含 `list.pageSize`、
分页器 `pageSize: list.pageSize` 且带 `pageSizeOptions` 与 `onPageSizeChange`。少任何一处都会出现
「选择器变了但列表不变」或「列表变了但页码算错」。本批在应用商店管理上就漏了请求参数这一处。
### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-10 — 不足一页不渲染分页器，因此也没有档位

工作空间配额、工作空间角色这类列表的数据量常常不足一页。旧 console 在这种情况下同样不显示分页器。
把选择器强行常驻会造出一个「选 50 条但只有 4 条数据」的死控件；因此这些页面保留 `paged = rows.length > pageSize`
的判断，只在真的分页时才出现分页器与档位。验收时「选择器不存在」是正常结果，用例对此显式跳过而不是判失败。

### GOT-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-10 — 分页器的 ai 句柄来自 sortAiPrefix

分页器（含档位选择器）的 `data-ai-id` 由 `schema.sortAiPrefix` 派生。给列表接档位时如果没设这个前缀，
选择器在页面上是有的，但自动化找不到它（`<前缀>:page-size` 不存在）。本批的集群告警消息页就是这样漏掉的。
## 系统现状

首个资源模块，无可继承的历史实现；行为以需求为准。

## 仓库落点

- 页面：`kube-frontend/apps/console-next/src/pages/configmaps/ConfigMapsPage.tsx`
- 查询：`kube-frontend/apps/console-next/src/pages/configmaps/queries.ts`

## 对外契约

见 L1 的 `/api/configmaps` 契约；本功能点不新增端点。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03 — 项目筛选等价于切换命名空间

**为什么**：kapis 没有「跨多个命名空间过滤」的参数。项目筛选若只是加一个查询参数，服务端会忽略它，于是筛选器显示的与列表展示的不是同一批数据——这正是「全部项目只显示一条」那次缺陷的成因。选中项目时请求该项目的命名空间；「全部项目」时去掉命名空间段，走集群级集合。

**被否方案**：前端先拉全部再本地过滤。集群级集合在大集群上要扫描全部命名空间，单页耗时以秒计，且无法分页。

**何时重新考虑**：kapis 提供带命名空间过滤的集合端点时。

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04 — 分页参数对齐旧 console

**为什么**：旧 console 直接发送 `page` 与 `limit`，由 kapis 完成切片，并读取 `totalItems` 作为总数。这与旧版保持一致，页码可以任意跳转。

**被否方案**：使用 `continue` 游标。游标只能顺序前进，无法随机跳页，且事后证明它在产品路径上并不必要——那次判断依据的是开发 harness（`kubectl proxy`）的行为，而它不实现 kapis 分页。

**何时重新考虑**：上游切到只支持游标的存储。

## 不变量

- **INV-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — 页面只通过 `AiSurface` 发布状态，不自行拼装属性。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01** — `aria-sort` 只能有一个 `ascending`/`descending`，其余列必须是 `none` 或省略。全部给 `none` 会让读屏软件把每列都读成可排序，而实际只有两列可排。
  处置：只给可排序列加 `aria-sort`。
- **GOT-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02** — 列宽用 `style={{ width }}` 而不是 Tailwind 类：`ListColumn.width` 可能是数字或百分比，动态类名不会被 Tailwind 扫描到。
  处置：宽度走 inline style。

## 测试与可观测

- 单元/集成：`apps/console-next/test/configmaps-page.test.tsx`
- 约束：`config/ai-surface-contract.test.ts`

## 后续改进

与需求「明确不做」保持一致，扩展时先改需求再改方案。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-01`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-02`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-03`
- `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-04`

### DEC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-05 — 键列截断而非换行

**为什么**：自动生成的 ConfigMap（Spring 的 `application-*.properties`、Helm 渲染的合并配置）
动辄几十个键。换行渲染在实测里让该行高度达到其他行的数倍，滚动时整张表的行高来回跳，比看不到
几个键更难用。截断让每行等高，完整内容留在 `title` 与详情页，信息仍然可达。

按码点计数（`Array.from`）而不是 `slice(0, 50)`：键名是任意用户文本，按 UTF-16 单元切会从
代理对中间截断，渲染出替换字符。

**被否方案**：`wrap: true` 多行展示。可读性更好，但破坏了表格的行节奏，且列宽会随数据变化。
**被否方案**：CSS `truncate`（`text-overflow: ellipsis`）。更省事，但截断位置取决于列宽而不是
50 个字符，无法满足「超过 50 个字符」这一明确阈值，也在窄屏下不可预测。


## 刷新与空态出口

列表的刷新由 `@/components/resource/useListRefresh` 提供：它同时给出 schema 的 `refresh` 条目与 `onRefresh` 回调，页面无法只接一半（`ResourceList` 只在两者都在时渲染按钮）。忙碌状态取查询自身的 `isFetching`，因此后台重取（窗口聚焦、翻页）也会反映在按钮上。空态的出口同样由该 hook 的 `emptyLabels` 注入（`emptyClear` / `emptyRefresh`），与刷新共用同一份文案，避免两个页面写成两种说法。

### DEC — 刷新按钮不替代轮询或 watch

**为什么**：本轮只补「读者主动重读」的能力。实时刷新（watch/轮询）会改变请求量与页面状态机，是另一件事，登记在能力矩阵 R-27；把刷新做成定时轮询会让每个列表在没有读者时也持续打服务端。
