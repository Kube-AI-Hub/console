# 集群级存储卷声明（L3）

[子模块需求](./_index.md)

## 概述

集群里全部项目的持久卷声明（PVC）跨项目只读列表，路由 `/kube-frontend/clusters/<cluster>/persistentvolumeclaims`。行带**项目列**，名称链到该项目内的 PVC 详情页。

老 console 的「存储」默认页签就是这张列表：存储问题的第一步不是「这个项目里有什么卷」，而是「哪个项目的卷还在 Pending、哪块盘被谁占了」。项目级存储页按定义只能看一个项目，回答不了这个问题。

## 用户故事

### US1 - 跨项目定位一张存储卷 (Priority: P1)

作为 **集群管理员**，我希望 **不进入具体项目就按名称检索集群里的存储卷声明**，以便 **先确认它属于哪个项目、处于什么状态，再跳到该项目处理扩容或删除**。

**Independent Test**：打开集群级存储卷页，核对行数等于 `min(20, total)`、项目列等于对象命名空间、名称链接含 `/projects/<namespace>/persistentvolumeclaims/<name>`；输入一个唯一名称后行数收敛到 1。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01** — 已知集群里有存储卷声明，当打开集群级存储卷页，则列出名称（链接到该对象所属项目内的 PVC 详情）、项目、状态、容量、访问模式、存储类型与创建时间；每页行数等于 `min(20, total)`；项目列等于对象命名空间；名称链接形如 `/kube-frontend/<workspace>/clusters/<cluster>/projects/<namespace>/persistentvolumeclaims/<name>`；按名称的服务端搜索可用，分页每页 20 条。

## 设计目标

1. 一张列表回答「在哪、什么状态、多大、什么访问模式、哪个存储类型」。
2. 行内能进到对象所属项目，写操作留在项目页。
3. 集群级集合较慢，页面必须给加载态与错误重试。

## 约束与边界

- 读 `/kapis/resources.kubesphere.io/v1alpha3/persistentvolumeclaims`（无 namespace 段 = 跨项目）；不逐项目循环。
- 服务端参数只有 `limit` / `page` / `sortBy` / `ascending` / `name`；不做 `fieldSelector` 筛选（kapis 代理忽略它，见迁移计划 §52）。
- 只读：创建、删除、扩容、编辑信息/YAML 都不在集群页。
- 项目 → 企业空间由命名空间列表一次性索引；解析不到时链接回落 `public`。

## UI 交互设计

- 侧栏「存储」分组下的存储卷入口（registry 条目由 Lead 维护）；页内无项目切换器。
- 列表：关键字搜索（防抖后触发服务端搜索）、名称/创建时间可排序、底部分页。
- 列：名称（链接）、项目、状态（徽章）、容量、访问模式、存储类型、创建时间；窄屏依次折叠访问模式、存储类型与创建时间。
- 空态：没有对象或当前条件下没有对象；失败：错误面板 + 重试。

## 文案与校验

- 标题 `cluster.pvc.title`（存储卷），描述 `cluster.pvc.description`。
- 列标题沿用存储词典：名称、状态、容量、访问模式、创建时间，存储类型用 `storage.field.storageClass`；项目列用 `cluster.workloads.column.project`。
- 状态由 API 的 phase 翻译（已绑定 / 等待中 / 已丢失 / 扩容中）；未知状态原样显示。
- 容量取 `spec.resources.requests.storage`；空值显示 `-`。

## 边界情况

- 同名 PVC 出现在多个项目：行句柄用「项目/名称」，不用名称单键。
- 使用默认 StorageClass 的声明 `spec.storageClassName` 为空：存储类型列显示 `-`。
- 状态为 `Pending`（未绑定）或 `Lost`（后端卷丢失）：仍列出，分别用警告与危险色标出。
- 命名空间读失败：链接回落 `public`，列表本身仍可读。
- 搜索无结果：行数为 0 并显示空态，而不是保留上一页数据。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01** — 集群级存储卷声明的跨项目只读列表。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-02** — 项目列、项目内 PVC 详情链接，以及服务端关键字搜索与分页。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01** — 行数 = `min(20, total)`；项目列 = 对象命名空间；名称链接含 workspace、项目与 `persistentvolumeclaims` 段；搜索与翻页都产生新的服务端请求。

## 明确不做

- 集群级创建 / 删除 / 扩容 / 编辑：写操作回项目作用域。
- 挂载状态列：需要列出全集群的 Pod 才能判断，集群级首屏成本过高；项目页已有该列。
- 存储卷快照：集群级快照列表不在本功能点。

## 假设

- 容量取请求值（`requests.storage`），与项目页展示一致，不读取实际占用。
- 项目归属由命名空间的 `kubesphere.io/workspace` 标签给出；缺失时按 `public` 处理。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PVC-01`
