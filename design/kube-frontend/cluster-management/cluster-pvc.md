# 集群级存储卷声明 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-pvc.md)

## 概述

一页跨项目 PVC 只读列表，复用 `storageApi` 的 `StorageSummary` 与 `useClusterProjectIndex`（集群级配置三页已建立的模式）。只新增页面、路由、文档与用例，不改 api-client。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01

## 设计目标与非目标

目标：一张表回答「在哪个项目、什么状态、多大、什么访问模式、哪个存储类型」；行内跳到项目页；大集合有加载态与错误重试。
非目标：集群级写操作、挂载状态列、快照列表、按项目/状态的筛选器。

## 关键约束

- 读集群级 kapis 集合（无 namespace 段）：`/kapis/resources.kubesphere.io/v1alpha3/persistentvolumeclaims`。
- 服务端参数只有 `limit` / `page` / `sortBy` / `ascending` / `name`；不做 `fieldSelector`（代理忽略，迁移计划 §52）。
- 项目 → workspace 只读一次命名空间列表；解析不到回落 `public`。
- 只读，不渲染任何写操作入口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01 — 复用 storageApi，不新增 PVC 读接口

**为什么**：`storageApi(client, 'persistentvolumeclaims')` 的 `list` 已经走 `resourceApi`，`namespace: ''` 即集群级集合，且 `toStorageSummary` 已从对象里取出 status（phase 折叠扩容条件）、capacity、accessModes、storageClass、createdAt——正是这一页需要的全部列。再包一层 API 只会多一份字段映射。
**被否方案**：在 api-client 里新增 `persistentVolumeClaimsApi`。没有新行为，只有重复。
**何时重新考虑**：集群页需要 api-client 当前 summary 不带的字段（例如挂载关系）时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-02 — 行键用「项目/名称」

**为什么**：PVC 名称跨项目不唯一（`public-models` 这类名字多个项目都会用）。名称单键会让 React 键重复，并让自动化的行定位器一次匹配多行。
**被否方案**：沿用工作负载页的 `data-ai-row=name`；工作负载名通常唯一，PVC 不满足这个前提。
**何时重新考虑**：列表改为按项目分组渲染时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-03 — 不做挂载状态列

**为什么**：`已挂载` 需要列出全集群 Pod 再反查 mount，集群级首屏本来就是最慢的读，再乘一次 Pod 全量列表不可接受；而且这一页的问题是定位而不是删除决策。项目页保留该列。
**被否方案**：异步补一列挂载状态。首屏会长时间显示「计算中」，读者会把它读成故障。
**何时重新考虑**：apiserver 提供 PVC→Pod 的反向索引接口时。

## 系统现状

老 console 存储分组默认页签即集群级存储卷列表（列含项目）。新 console 的项目作用域存储页已交付（可编辑、含挂载状态列），集群级存储分组目前只有存储类型与持久卷两页；registry 的集群级存储卷条目由 Lead 在共享文件里补，本功能点不修改 registry.ts。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterPersistentVolumeClaimsPage.tsx`
- 共用：`apps/console-next/src/pages/cluster/useClusterProjectIndex.ts`（项目索引、项目内链接、行键）
- 路由：`routes/kube-frontend.clusters.$cluster/persistentvolumeclaims/{route,index}.tsx`
- 注册：`areas/registry.ts`（集群作用域 `persistentvolumeclaims`，存储分组；共享文件，由 Lead 维护）
- 用例：`tests/ui/specs|tests/kube-frontend/cluster-management/`

## 对外契约

| 用途 | 路径 | 参数 |
| --- | --- | --- |
| 存储卷声明（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/persistentvolumeclaims | limit, page, sortBy, ascending, name |
| 命名空间（取 workspace） | /kapis/resources.kubesphere.io/v1alpha3/namespaces | limit=500 |

## 不变量

1. 行数 = `min(20, total)`。
2. 项目列 = 对象的 `metadata.namespace`。
3. 名称链接含 `/projects/<namespace>/persistentvolumeclaims/<name>`，并带 workspace 段。
4. 页面只读：没有创建/删除/扩容/编辑入口。

## 已知坑

- **代理忽略 fieldSelector**：不做筛选（§52）；前端过滤当前页只会筛 20 行。
- **名称跨项目不唯一**：行键必须是项目/名称（DEC-02）。
- **默认 StorageClass 无类名**：使用默认类的 PVC `spec.storageClassName` 为空，列显示 `-`。
- **locale 只有标题**：`cluster.pvc.title/description` 之外没有专属列键，列复用 `storage.column.*` 与 `storage.field.storageClass`；要改中文措辞需先加 locale 键。
- **registry 条目不在本功能点**：共享文件由 Lead 维护；页面本身不依赖 registry 才能渲染（直接 URL 可达）。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01.yaml`
- 可观测点：`cluster-pvc:surface`（`data-ai-state` 为 loading/ready/empty/error）、搜索框 `cluster-pvc:search`、行句柄 `data-ai-row=<namespace>/<name>`、名称 `cluster-pvc:name:<namespace>/<name>`、重试 `cluster-pvc:retry`。

## 后续改进

- 集群级挂载状态（需要 Pod 反向索引）。
- 按项目/状态筛选（等服务端支持）。
- 成员集群上的集成验证（本环境只有 host 集群）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01
