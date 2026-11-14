# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01 列表列显隐 · 隐藏、持久化与恢复

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `column-visibility`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/column-visibility.md`

## 产品功能

项目工作负载列表与集群级列表提供「显示列」菜单：读者可隐藏不关心的列，选择按页面存 localStorage，刷新后仍生效；重新勾选全部列恢复默认。默认（没有存储选择）时列表渲染与接线前一致。

### 关联需求

- `prd/kube-frontend/app-workloads/column-visibility.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/column-visibility.md`](../../../../prd/kube-frontend/app-workloads/column-visibility.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-COLUMN_VISIBILITY-01** — 已知打开容器组列表，则工具栏显示 data-ai-id=pods:columns 的「显示列」菜单且表格包含「所在节点」列；当在该菜单取消勾选「所在节点」，则该列表头与其单元格消失、其余列保留，localStorage 记录该页隐藏的列；刷新页面后「所在节点」仍不出现；当重新勾选，则该列立即恢复且该页恢复默认（localStorage 记录被清除）。集群级容器组与工作负载列表也提供同样的「显示列」菜单，且默认渲染与接线前一致。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/column-visibility.md`](../../../../design/kube-frontend/app-workloads/column-visibility.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/column-visibility.md`](../../../../prd/kube-frontend/app-workloads/column-visibility.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在列表里只看我关心的列 (Priority: P1)

作为 **项目运维**，我希望 **在列表的「显示列」菜单里取消不关心的列，并让这个选择在刷新后仍然有效**，以便 **在窄屏或排查时把注意力集中在少数几列上**。

**Independent Test**：在容器组列表取消勾选「所在节点」，表头不再出现该列；刷新后仍隐藏；重新勾选后恢复。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间（容器组列表可达）
- 用例先清掉容器组页的列选择记录（kube-frontend.columns.workloads:pods）

## 测试步骤

1. 打开容器组列表，等待主区就绪，读取表头与 pods:columns 触发器
2. 点开「显示列」菜单，取消勾选「所在节点」
3. 读取表头与 localStorage 记录
4. 刷新页面，再次读取表头
5. 重新打开菜单，勾选「所在节点」，读取表头与 localStorage 记录

## 期望结果

- 初始表头含 名称、状态、所在节点、创建时间；pods:columns 触发器可见
- 取消勾选后表头不再含「所在节点」，其余列保留（名称仍在）
- localStorage 键 kube-frontend.columns.workloads:pods 的 JSON 数组不含 node，且含 name
- 刷新后「所在节点」仍不出现
- 重新勾选后「所在节点」立即恢复，且 localStorage 记录被清除（恢复默认）

## 失败排查

- 菜单不出现：页面未传 schema.columnVisibility 或未接 onVisibleColumnsChange
- 勾选后表头没变：列缺少 hideable 标记，或 visibleColumnKeys 没有传给 ResourceList
- 刷新后列表变空/丢列：多 kind 页面共用了同一个 storage key，或存储了未知列 key 未过滤

## 产品改版后如何更新自动化

- 句柄由 ai-kit 按 schema.columnVisibility.aiId 生成：<pagePrefix>:columns[:<columnKey>|:reset]
- 列 key 变化时改用例里的 pods:columns:node 与存储断言
