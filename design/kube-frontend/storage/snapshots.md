# 卷快照与快照类型（L3）

[子模块需求](../../../prd/kube-frontend/storage/snapshots.md)

## 概述

在集群作用域新增两页：`volume-snapshots`（跨项目卷快照）与 `volume-snapshot-classes`（快照类型）。两页共用一个新模块 `pages/cluster/snapshotQueries.ts` 负责 discovery 探测、kapis 分页读取与行映射；页面本身只做列表骨架。

## 关联需求

- AC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01

## 设计目标与非目标

目标：集群视角的只读快照列表与类型列表；CRD 缺失时给可操作说明；分页/搜索/排序与既有集群列表一致。

非目标：快照内容（VolumeSnapshotContent）视图、`snapshots` 别名路由、任何写操作、快照恢复流程。

## 关键约束

- 集群页位于 `/kube-frontend/clusters/<cluster>/…`：没有 workspace 与项目段，页面参数只有 `cluster`。
- 数据来源：kapis 通用资源代理（`/kapis/resources.kubesphere.io/v1alpha3/…`）提供分页、搜索与 `totalItems`；CRD 可用性来自 `/apis/snapshot.storage.k8s.io/v1` 的 discovery。
- 项目控制台 URL 需要企业空间段，由既有的 `useClusterProjectIndex` 把 namespace 映射到 workspace。
- 不改 api-client：项目级 `storageApi` 的 snapshot 映射没有 `volumeSnapshotClassName`，也没有快照类型读取，硬塞进它会让项目页与本功能互相牵连。
- 不新增测试 page object；用例直接用 `cluster_management_page` 夹具与 BFF 探测。

## 方案决策

### DEC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01 — CRD 可用性用 discovery 探测，不用列表失败来猜

**为什么**：kapis 列表在 CRD 缺失时的错误形状不稳定（可能是 404，也可能是 500 或空 200），把「列表失败」等同于「未安装」会在权限问题、上游抖动时给出错误指引。discovery 只看 API 组是否存在，语义单一。

**被否方案**：直接请求列表，空结果就显示「未安装」。无法区分「没有对象」与「没有 CRD」——而这正是本功能点要回答的问题。

**何时重新考虑**：ks-apiserver 提供稳定的「扩展组件是否安装」查询时。

### DEC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-02 — 两个集群页直接读 kapis 集合并本地映射行

**为什么**：`storageApi` 的 snapshot summary 把 `spec.storageClassName` 当快照类型（那是 PVC 字段），且没有 VolumeSnapshotClass 读取。集群页只需要六列/五列，直接映射比先扩 api-client 再把项目级页面迁过去风险小得多；api-client 保持不动，项目级存储页不受影响。

**被否方案**：扩展 `StorageKind` 加 `volumesnapshotclasses`。类型是项目级存储的 API 形状，集群级 CRD 与它的生命周期、分页语义都不同，混进去会让项目页的描述符逻辑长出分支。

**何时重新考虑**：项目级快照页需要显示真实的 `volumeSnapshotClassName` 时，修正 api-client 的映射并让两处共用。

### DEC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-03 — 名称与项目列都回到项目控制台的既有页面

**为什么**：集群页只读，读者看到异常后的下一步是进入该项目处理。名称链到 `…/projects/<ns>/volumesnapshots/<name>`（项目级已有的快照详情），项目列链到 `…/projects/<ns>/volumesnapshots`（该项目的快照列表）。两个目标页都已存在，不新增路由。

**被否方案**：项目列链到项目概览。项目概览不展示快照，绕一圈才能到；快照列表是同一份数据的项目视图。

**何时重新考虑**：项目控制台出现独立的「存储概览」页时。

### DEC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-04 — 行句柄带项目前缀

**为什么**：快照名称只在命名空间内唯一，两个项目可以各有一个 `daily`。行句柄取 `<namespace>/<name>`，与集群存储卷声明页一致；否则 React key 冲突，自动化定位也会命中多行。

**被否方案**：只用名称。跨项目列表里必然重复。

## 系统现状

老 console 的集群「存储」是一组并列页面：存储卷声明、卷快照、快照类型、存储类型、持久卷。新 UI 已迁移存储卷声明、存储类型与持久卷；卷快照只有项目级页，快照类型没有入口。本功能点补齐缺口，不重排导航（registry 已登记两页）。

## 仓库落点

- `apps/console-next/src/pages/cluster/ClusterVolumeSnapshotsPage.tsx`
- `apps/console-next/src/pages/cluster/ClusterVolumeSnapshotClassesPage.tsx`
- `apps/console-next/src/pages/cluster/snapshotQueries.ts`（discovery、两个 kapis 列表、行映射）
- 路由：`src/routes/kube-frontend.clusters.$cluster/{volume-snapshots,volume-snapshot-classes}/{route,index}.tsx`
- 文案：`packages/locales/src/index.ts` 的 `storage.snapshots.*` 与 `storage.snapshotClasses.*`

## 对外契约

- 页面句柄：`data-ai-id="cluster-volume-snapshots:surface"`、`data-ai-id="cluster-snapshot-classes:surface"`。
- 行句柄：`data-ai-row="<namespace>/<name>"`（快照）、`data-ai-row="<name>"`（类型）。
- 搜索/排序/分页句柄沿用 `ResourceList` 约定：`cluster-volume-snapshots:search` 等。
- 读取：`GET /apis/snapshot.storage.k8s.io/v1`（存在性）；`GET /kapis/resources.kubesphere.io/v1alpha3/{volumesnapshots,volumesnapshotclasses}?page&limit&sortBy&ascending&name`。
- 页面 URL：`/kube-frontend/clusters/<cluster>/volume-snapshots`、`…/volume-snapshot-classes`。

## 不变量

- 集群页只读：不出现创建/删除/恢复动作。
- 分页每页 20 行；页面显示行数等于 `min(20, total)`。
- CRD 缺失时页面状态为 `empty` 且带说明卡片，绝不渲染空表。
- 快照行句柄唯一（项目前缀）；项目列文本等于对象的 namespace。

## 已知坑

- 快照状态的 `status.error` 是对象，字段在 `message` / `code` 里；直接 String(error) 会得到 `[object Object]`。
- 英文文案里含撇号（`every project's`）时必须用双引号，否则 locale 文件语法错误。
- 集群页在 kube 模式（kubectl-proxy harness）下不能做跨项目 kapis 列表；当前环境是 kapis 模式，harness 下会由 BFF 返回 400，页面显示错误面板——这是环境限制，不是页面缺陷。
- 项目控制台 URL 必须带企业空间段；namespace 索引未就绪时用 `public` 兜底只能保证可点击，不保证该项目真的在 public。

## 测试与可观测

- E2E：`TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01`。用例用 `cluster_management_page` 夹具（admin 会话）：
  1. 探测 discovery 与两处 kapis 总数；
  2. 打开两页并等待 `data-ai-state` 离开 loading；
  3. CRD 存在时：有数据断言行数 `min(20,total)`，无数据断言空态文案；CRD 缺失时断言「本集群未安装快照 CRD」；
  4. 快照类型页创建一条临时 VolumeSnapshotClass（CRD 存在时）验证数据路径，结束后删除。
- 观测点：页面句柄与行句柄就是断言入口，不需要等待网络空闲。

## 后续改进

- 快照内容（VolumeSnapshotContent）视图与 `snapshots` 别名路由。
- 项目级快照页显示真实的 `volumeSnapshotClassName`（修正 api-client 的 summary 映射）。
- 快照创建/恢复流程（写路径迁移后）。
- 集群页按项目过滤（复用项目过滤器）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-STORAGE-SNAPSHOTS-01`
