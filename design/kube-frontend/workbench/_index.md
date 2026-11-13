# 工作台 · 技术方案（L2）

## 概述

工作台（`/kube-frontend/`）是项目控制台的入口页。它把「企业空间 → 项目（属于某个集群）」
这条平台实际执行的关系显示出来，并链接到项目控制台。

## 关联需求

- `AC-FULL-KUBE-FRONTEND-WORKBENCH-01`

## 设计目标与非目标

目标：入口可达、层级可见、一次点击进入项目。非目标：仪表盘统计、在工作台创建项目。

## 关键约束

- 项目 = 带 `kubesphere.io/workspace` 标签的命名空间；普通命名空间不是项目。
- 项目按 `(集群, 命名空间)` 唯一，同名项目可能存在于不同集群。
- 顶部「工作台」入口指向 `/kube-frontend/`，该路径必须有路由。

## 页面与技术结构

```
/apps/console-next/src
  pages/workbench/WorkbenchPage.tsx    # 页面
  routes/kube-frontend.index.tsx       # /kube-frontend/ 正式路由
  routes/index.tsx                     # / 重定向到 /kube-frontend
  components/projects/useProjects.ts   # useProjectsByWorkspace / useProjectOptions(cluster, workspace)
  shell/WorkspaceBar.tsx               # 项目控制台的三级上下文栏
```

数据：`clustersApi.list` → 每个集群 `projectsApi.list`（按集群缓存）→ 按 workspace 标签分组；
`workspacesApi.list` 补上「有企业空间但本会话看不到项目」的情况。

## 状态与数据归属

- 工作台只读；写操作留在项目控制台与平台管理。
- 项目列表按集群缓存（`projectsQueryKey(cluster)`），与各处选择器共用一次请求。

## 关键契约与依赖

| 用途 | 接口 |
| --- | --- |
| 集群列表 | `GET /kapis/cluster.kubesphere.io/v1alpha1/clusters` |
| 集群内命名空间（带 workspace 标签） | `GET /kapis/resources.kubesphere.io/v1alpha3/namespaces` |
| 企业空间列表 | `GET /kapis/tenant.kubesphere.io/v1alpha2/workspaces` |

## 已知坑

- 集群的项目是异步加载的：页面 ready 之后分组才出现，测试必须等分组而不是立即取样。
- 顶部入口历史上指向没有路由的 `/kube-frontend/`，点击落到 Not Found。

## 不变量

1. 顶部「工作台」永远能到达页面（`/kube-frontend/` 有路由）。
2. 没有 `kubesphere.io/workspace` 标签的命名空间不出现在工作台。
3. 项目下拉只列当前企业空间的项目。

## 测试与可观测

用例见各功能点：工作台入口 `entry.md`、项目上下文栏 `context.md`；L2 用例覆盖入口到项目的完整路径。

## 明确不做

- 工作台内的创建入口；跨集群聚合统计。

## 假设

- 项目与企业空间的归属由命名空间标签决定。

## 后续改进

- 企业空间标题链到企业空间控制台（Phase 2）。
- 项目胶囊显示状态与最近访问。

## 功能点

- [工作台入口](./entry.md)
- [项目上下文栏](./context.md)

## 验收用例

- 见各功能点文档；L2 验收用例在 `entry.md` 中登记。
