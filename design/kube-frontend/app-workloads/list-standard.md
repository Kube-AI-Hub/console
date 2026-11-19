# 列表交互标准 · 技术方案（L3）

> 承接 [`prd/kube-frontend/app-workloads/list-standard.md`](../../../prd/kube-frontend/app-workloads/list-standard.md)。

## 概述

本文件说明四项列表标准落在哪一层、为什么落在那里，以及各页面的接线方式。不复述需求。

## 关联需求

- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03`
- `AC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-04`

## 设计目标与非目标

**目标**：四项行为一次实现在共享层，页面只声明数据；漏接可被静态检出。

**非目标**：不改任何一页的默认列、默认排序与分页档位（这些是用户可见契约）。

## 关键约束

- 固定列必须有显式 `width`；`ResourceList` 对没有宽度的 pin 只告警并忽略。
- pin 与 hideable 在类型上是互斥联合，写在一起是编译错误。
- 「清除全部条件」只在 `labels.clearFilters` 存在时渲染。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01 — 刷新三件套由 hook 一起给

**为什么**：`refresh`（按钮声明）、`onRefresh`（回调）、`refreshing`（遮罩）是同一件事的三半。此前每页手写 `refresh: { label, aiId, busy }` 并各自传 `onRefresh`，`refreshing` 只有节点列表接了——于是四十多个页面点刷新时表格毫无变化，慢响应看起来像按钮坏了。

`useListRefresh(aiPrefix, query)` 现在返回 `refresh` / `onRefresh` / `refreshing` / `emptyLabels` / `filterLabels`。页面取用同一个对象，不能只接一半；`refreshing = isFetching && !isPending`，首次加载仍走骨架行。

**被否方案**：在 `ResourceList` 内部轮询 `aria-busy` 或从 `loading` 推断。组件拿不到查询状态，猜出来的遮罩会在首次加载时和骨架行叠加。

**何时重新考虑**：若某列表需要「静默后台刷新」（不打扰阅读），加一个 `silent` 参数而不是让页面绕过 hook。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02 — 字段筛选挂列头，工具栏只留跨字段控件

**为什么**：读者说「只看运行中」时，落点是状态列。把筛选放在列头，控件出现在值旁边，且不必为每个字段在工具栏加一个下拉。工具栏保留的是跨字段控件：项目范围、行搜索、时间窗。

`ListFilter.column` 指向列 key，`ResourceList` 把 `ColumnFilter` 渲染进该列表头（排序按钮旁边，`stopPropagation` 避免误触排序）。单选选中即关闭，多选保持打开。

**被否方案**：工具栏里堆一排字段下拉。字段一多工具栏就换行，且搜索框会随筛选项数量左右移动——这正是节点列表此前修过的问题。

**何时重新考虑**：某个筛选跨多列（如「按名称或描述」）时，它本来就不是字段筛选，应留在工具栏。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03 — 状态筛选的取值按资源类型各自声明

**为什么**：kapis 各 getter 的状态词表不同，且**未知值返回 0 行**（实测部署/任务/定时任务/容器组均是），所以传错词表不会报错，只会让列表空掉。部署用 `running|updating|stopped`，任务用 `running|completed|failed`，定时任务用 `paused|running`，容器组用 `Waiting|Running|Completed|Error`。

`WorkloadDescriptor.statusFilter` 让每类声明自己的词表，页面据此生成列头筛选项。任务另加 `condition` 字段：徽标沿用老 console 把失败折成「更新中」的口径，而筛选需要服务端自己的 `failed`，两者不能共用一个字段，否则「失败」筛选永远返回空。

**被否方案**：全站共用一套状态词表。部署页的「运行中」能过滤，任务页的「已完成」却会静默返回空表。

**何时重新考虑**：后端统一状态词表时，改为从 API 读取可选值。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-04 — 固定首列与固定尾列的视觉权重不同

**为什么**：首列是行身份（名称、链接），尾列是动作菜单。两者同色会让视线在省略号上停留得和名称一样久。`Table` 的 `pinClasses` 用 `--ai-pin-start` / `--ai-pin-end` 两个语义 token，深浅主题各自定义；表头沿用相邻表头的底色，避免出现一条被切掉的浅色带。

**被否方案**：都用页面底色。浅色主题下与白行对比过小，固定列看起来像表格缺口。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-05 — 用源码契约守住四项接线

**为什么**：四项都是「页面看起来正常」的缺失：没有 pin 时表格照样渲染，只是滚动后丢了行名。逐页写渲染测试要几分钟，且下一个人新增页面时不会写。`config/list-standard-contract.test.ts` 读源码断言：列表页必须有 `pin: 'start'`、pin 附近必须有 `width`、有 `refresh` 必须有 `refreshing`、有筛选必须有 `clearFilters` 或 `filterLabels`。

面板型表格（`NodeRankingPanel` / `NodeResourcesPanel` / `GpuPodsPanel`）显式豁免：它们嵌在卡片里，没有独立工具栏与行身份。

**被否方案**：只靠 code review。这四项在最近一次重构里已经丢过一次（集群级负载页的项目筛选与行操作整块消失，E2E 才抓到）。

## 系统现状

`ResourceList` 与 `Table` 已具备 `pin` / `hint` / `refreshing` / `ListFilter.column` 能力；缺的是各页接线一致，以及一条能发现漏接的守卫。

## 仓库落点

- 共享 hook：`kube-frontend/apps/console-next/src/components/resource/useListRefresh.ts`
- 共享列表：`kube-frontend/packages/ai-kit/src/schema/ResourceList.tsx`、`.../primitives/Table.tsx`
- 工作负载族：`kube-frontend/apps/console-next/src/pages/app-workloads/{WorkloadListPage.tsx,queries.ts}`
- 集群级负载：`kube-frontend/apps/console-next/src/pages/cluster/ClusterWorkloadsPage.tsx`
- 契约：`kube-frontend/config/list-standard-contract.test.ts`

## 对外契约

不新增接口。状态筛选复用 kapis 既有的 `?status=`；列头筛选沿用 `ResourceList` 的 `data-ai-id="<前缀>:filter:<字段>"`。

## 不变量

- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01** — 固定列必须有显式宽度；无宽度的 pin 被忽略并告警，不会半生效。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02** — 固定首列不进入「显示列」菜单；pin 与 hideable 互斥由类型保证。
- **INV-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03** — 首次加载用骨架行，重取用遮罩；两者不会同时出现。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01** — 状态筛选传错词表不会报错，只会返回 0 行。判断方法：拿一个不存在的状态值请求，返回 0 才说明该 getter 真的在过滤；返回全集说明参数被忽略。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02** — `loading={query.isFetching}` 会让每次翻页都闪骨架屏，且遮罩永不出现（`loading` 优先级更高）。必须拆成 `loading={isPending}` 与 `refreshing={isFetching && !isPending}`。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-03** — 给同一列同时写 `pin` 与 `hideable` 是类型错误；批量改脚本时容易留下重复 `width`，`tsc` 会以 TS1117 报出。
- **GOT-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-04** — 集群级负载页的行操作必须用**行自己的命名空间**寻址；用页面的空命名空间会拼出没有 `namespaces/<ns>` 段的路径并 404。

## 测试与可观测

- 契约：`kube-frontend/config/list-standard-contract.test.ts`（四项接线 + 面板豁免）
- 单测：`apps/console-next/test/status-labels.test.tsx`（共享状态文案表）
- E2E：`TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01/02`、`CLUSTER_WORKLOADS-01..03`

## 后续改进

多字段排序、列宽拖拽不在本批；如需，先改需求再改方案。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-01`
- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-LIST_STANDARD-02`
