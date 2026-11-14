# 列表列显隐（L3）

[子模块需求](../../../prd/kube-frontend/app-workloads/column-visibility.md)

## 概述

ai-kit ResourceList 已实现列选择器（schema.columnVisibility 触发、visibleColumnKeys 过滤、onVisibleColumnsChange 回传），但页面没接线。本轮新增共享 hook components/resource/useColumnVisibility.ts，把「按页面记忆的选择」补上，并接到项目工作负载列表（8 类）与集群级容器组/工作负载列表。不改 ai-kit，不新增组件。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01

## 设计目标与非目标

目标：复用 ResourceList 的列选择器；默认全显（无存储选择时渲染与改动前一致）；按页面记忆；至少保留一列；选择持久化在 localStorage。

非目标：列顺序/列宽调整、后端持久化、接线任务范围外的页面、改 ai-kit。

## 关键约束

- 无存储选择时 visibleColumnKeys 为 undefined：ResourceList 的过滤条件是 !hideable || !visibleColumnKeys || includes(key)，因此默认渲染与接线前逐列一致。
- 只有标 hideable: true 的列进入菜单；身份列 name 不标，保证表格永远至少一列。
- 选择键：kube-frontend.columns.<pageKey>，值 JSON 数组；pageKey 为 workloads:<kind> / cluster-pods / cluster-workloads:<kind>。
- 选择全部列等于默认：清除存储而不是记录全量数组，这样以后新增列默认可见。
- 数据请求、排序、分页不因隐藏列改变。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01 — 用共享 hook 管存储，ResourceList 管交互

**为什么**：列选择器的交互（菜单、勾选、触发重渲染、过滤列）已经在 ai-kit 里，页面缺的只是「选择存哪、默认值是什么、跨页面 key 怎么取」。把这段放进 hook，三个页面（含两个复用的多 kind 页面）只多两行调用；若每个页面各写一段 useState/localStorage，key 命名、默认值、损坏 JSON 处理会逐页漂移。

**被否方案**：在 ResourceList 内部加 localStorage。ai-kit 是纯展示层（无状态、无 i18n、无路由），存储属于宿主应用；写进去还会让所有使用方被迫共享同一套 key 语义。

**何时重新考虑**：需要列顺序/列宽一起持久化时，再引入一个更完整的表格视图偏好 hook，但仍放在应用层。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-02 — 默认全显 = 不传 visibleColumnKeys

**为什么**：回归风险最低。老页面没接线时 ResourceList 收到的就是 undefined；hook 在无存储/存储无效时返回 undefined，渲染路径完全不变。若默认传全量 key 数组，虽然视觉相同，但 ResourceList 会开始走过滤分支，未来 hideable 标记变化时会悄悄改变默认列。

**被否方案**：默认存一份全量数组。刷新/新增列时还要维护数组与列集合同步。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-03 — 按页面 kind 分 key，并忽略未知列

**为什么**：WorkloadListPage 与 ClusterWorkloadsPage 都由一个组件渲染多 kind，列集合随 kind 变化。若共用一个 key，在 Deployments 隐藏 ready 后切到 Pods（没有该列）会出现存储 key 与当前列不匹配；按 kind 分 key 后每个 kind 的偏好独立。仍对未知 key 做过滤：页面列集合将来缩减时，旧存储不会把整张表隐藏空。

**被否方案**：全局一个列偏好。不同资源列不同，会互相干扰。

## 系统现状

ai-kit ResourceList 约 553 行已有列选择器；NodesPage 是唯一接线的页面，用本地 useState（无持久化）。本轮抽出共享 hook，覆盖任务要求的页面。

## 仓库落点

- components/resource/useColumnVisibility.ts
- pages/app-workloads/WorkloadListPage.tsx（8 类工作负载；pageKey workloads:<kind>，aiId <kind>:columns）
- pages/cluster/ClusterPodsPage.tsx（pageKey cluster-pods，aiId cluster-pods:columns）
- pages/cluster/ClusterWorkloadsPage.tsx（pageKey cluster-workloads:<kind>，aiId cluster-<kind>:columns）

## 对外契约

- 触发器：<pagePrefix>:columns；菜单项：<pagePrefix>:columns:<columnKey>；恢复默认：<pagePrefix>:columns:reset（均由 ai-kit ResourceList 按 schema.columnVisibility.aiId 生成）。
- 菜单标题/恢复项复用现有 locale：node.list.columns（显示列）/ node.list.resetColumns（恢复默认列）。
- localStorage：kube-frontend.columns.<pageKey> = JSON.stringify(可见列 key 数组)，仅在非默认时存在。

## 不变量

- 未做选择时每种列表的可见列与接线前一致。
- 身份列不可隐藏，表格永远至少一列。
- 隐藏列不改变查询参数、排序与分页。
- 不同 pageKey 的选择互不影响。

## 已知坑

- 传给 hook 的 columnKeys 必须是稳定数组；页面用 useMemo 从 schema.columns 派生，避免每次 render 生成新数组导致 memo 失效。
- 多 kind 页面若用同一个 storage key，切换 kind 时未知列过滤可能让表突然变空；必须按 kind 分 key。
- 选择全部列时要清除 localStorage，否则以后新增列会被旧数组隐藏。
- localStorage 读写在隐私模式可能抛异常，hook 内 try/catch，不向上抛。

## 测试与可观测

E2E：TC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01。容器组列表：清掉存储 → 断言「所在节点」可见 → 打开 pods:columns → 取消 pods:columns:node → 表头不再含「所在节点」且存储数组不含 node → 刷新后仍隐藏 → 重新勾选 → 表头恢复且存储键被清除。回归：app-workloads 与 cluster-management 的现有用例（默认渲染不能变）。

## 后续改进

- 列顺序与列宽持久化。
- 把同一 hook 接到其它多列列表（节点列表已有本地实现，可迁移）。
- 需要跨设备时再考虑后端偏好。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01
