# TC-L3-KUBE-FRONTEND-WORKBENCH-CONTEXT-01 项目上下文栏 · 三级与不跨租户

- **用例 ID**: `TC-L3-KUBE-FRONTEND-WORKBENCH-CONTEXT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `workbench` `context`
- **入口**: `{BASE_URL}/kube-frontend/<ws>/clusters/<c>/projects/<ns>/configmaps`
- **需求**: `prd/kube-frontend/workbench/context.md`

## 产品功能

项目页顶部显示企业空间/集群/项目三级；项目下拉只含当前企业空间的项目。

### 关联需求

- `prd/kube-frontend/workbench/context.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/workbench/context.md`](../../../../prd/kube-frontend/workbench/context.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-WORKBENCH-CONTEXT-01** — 打开项目页，则上下文栏显示企业空间名、集群选择器与项目选择器；项目下拉包含当前企业空间的项目，且**不包含**其它企业空间的项目。

### 关联设计

- 技术方案 [`design/kube-frontend/workbench/context.md`](../../../../design/kube-frontend/workbench/context.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/workbench/context.md`](../../../../prd/kube-frontend/workbench/context.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看懂当前页属于谁 (Priority: P1)

作为 **读者**，我希望 **一眼看出当前项目属于哪个企业空间、哪个集群**，以便 **不会在错误的作用域里操作资源**。

**Independent Test**：打开任一项目页，上下文栏显示三级；项目下拉只包含当前企业空间的项目。

## 前置与配置

- 已登录
- 集群上至少两个企业空间各有项目

## 测试步骤

1. 读取集群命名空间与其企业空间标签
2. 打开某企业空间下某项目的页面
3. 核对上下文栏三级
4. 打开项目下拉，确认只含本企业空间项目

## 期望结果

- 上下文栏显示企业空间、集群选择器、项目选择器
- 项目下拉含当前项目
- 其它企业空间的项目不出现

## 失败排查

- 出现其它企业空间项目：项目下拉未传 workspace 过滤

## 产品改版后如何更新自动化

- 选择器变化时改 shell/WorkspaceBar 的 aiId
