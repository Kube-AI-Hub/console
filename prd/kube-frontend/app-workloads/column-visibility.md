# 列表列显隐（L3）

[子模块需求](./_index.md)

## 概述

老 console 的列表支持列显隐：每页有一个「显示列」菜单，读者可以隐藏不关心的列，例如只看容器组的名称与状态而隐藏节点、IP。新 UI 的 ai-kit ResourceList 已经实现了列选择器（schema.columnVisibility + visibleColumnKeys + onVisibleColumnsChange），但页面从未接线，于是每页都固定显示全部列。本功能点把列显隐接到项目工作负载列表与两个集群级列表页，并按页面记忆选择。

## 用户故事

### US1 - 在列表里只看我关心的列 (Priority: P1)
作为 **项目运维**，我希望 **在列表的「显示列」菜单里取消不关心的列，并让这个选择在刷新后仍然有效**，以便 **在窄屏或排查时把注意力集中在少数几列上**。

**Independent Test**：在容器组列表取消勾选「所在节点」，表头不再出现该列；刷新后仍隐藏；重新勾选后恢复。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01** — 已知打开容器组列表，则工具栏显示 data-ai-id=pods:columns 的「显示列」菜单且表格包含「所在节点」列；当在该菜单取消勾选「所在节点」，则该列表头与其单元格消失、其余列保留，localStorage 记录该页隐藏的列；刷新页面后「所在节点」仍不出现；当重新勾选，则该列立即恢复且该页恢复默认（localStorage 记录被清除）。集群级容器组与工作负载列表也提供同样的「显示列」菜单，且默认渲染与接线前一致。

## 设计目标

- 不新增组件：复用 ai-kit ResourceList 的列选择器与可见列过滤，只补一个共享 hook。
- 默认全显：没有存储选择时不传 visibleColumnKeys，渲染与改动前完全一致。
- 按页面记忆：不同资源/不同页面各自记忆，互不影响；重新勾选全部等于恢复默认。
- 至少保留一列：身份列（名称）不可隐藏。

## 约束与边界

- 选择存 localStorage，键为 kube-frontend.columns.<pageKey>，值为可见列 key 的 JSON 数组；读出失败/损坏视为默认全显。
- pageKey：workloads:<kind>（8 类工作负载各一份）、cluster-pods、cluster-workloads:<kind>。
- 列 key 必须稳定（页面 schema 里已有），隐藏的是列而不改变数据请求。
- 只有标了 hideable 的列出现在菜单里；身份列（name）不标。
- 不改 ai-kit ResourceList，也不改其它未接线页面。

## UI 交互设计

「显示列」按钮位于列表工具栏（搜索与刷新之间），点击打开多选菜单；每项带勾选状态，底部是「恢复默认列」。

- 触发器 data-ai-id：<pagePrefix>:columns；菜单项 data-ai-id：<pagePrefix>:columns:<列 key>；恢复默认：<pagePrefix>:columns:reset。
- 取消勾选后表头与单元格立即消失；勾选后立即恢复。
- 菜单保持打开以便连续调整（closeOnSelect=false）。

## 文案与校验

- 菜单标题：「显示列」；恢复项：「恢复默认列」。
- 菜单项用各列现有表头文案（名称、状态、所在节点、容器组 IP、创建时间等）。
- 不新增文案键。

## 边界情况

- 没有存储选择：全部列显示（undefined 可见列）。
- 存储的列 key 在当前页面不存在（例如从其它 kind 复用页面）：忽略未知 key，全部已知 key 都被隐藏时回退为默认全显，避免表格只剩非可隐藏列之外的空白。
- 隐藏到只剩身份列：允许，名称列始终可见，因此表格不会没有列。
- localStorage 不可用：选择只对当前渲染生效，不报错。
- 隐藏列不影响数据请求、排序与分页。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01** — 提供 useColumnVisibility(pageKey, columnKeys) hook：默认全显、按页记忆、至少保留一列、未知 key 过滤。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-02** — 接入项目工作负载列表（8 类）与集群级容器组、集群级工作负载列表。
- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-03** — 列菜单与菜单项暴露 <pagePrefix>:columns[:columnKey|:reset] 句柄。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01** — 隐藏列后刷新仍隐藏，重新勾选后恢复默认（无 localStorage 记录）。
- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-02** — 未做选择时所有已接线页面的表头与接线前一致（默认渲染回归通过）。

## 明确不做

- 不做列顺序拖拽或列宽调整。
- 不做按用户/后端持久化（只用 localStorage）。
- 不接线集群节点列表等其它页面（本轮只做任务列出的页面；节点列表已有自己的实现）。
- 不给非 hideable 列提供隐藏入口。

## 假设

- ai-kit ResourceList 的列选择器接口保持稳定（schema.columnVisibility、visibleColumnKeys、onVisibleColumnsChange）。
- 各页面列 key 已经是稳定标识。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01
