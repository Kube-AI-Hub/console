# JuiceFS 共享存储 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/juicefs.md)

## 概述

一个页面、三个页签（卷 / 用量 / 性能），共用一份卷清单。数据层新增 `pages/cluster/juicefsQueries.ts`：读平台 JuiceFS 聚合 API（`volumes` / `summary`）、一次集群级 PV 列表（join 状态与创建时间）、以及监控 API 的 `juicefs_*` 范围查询。页面是 `pages/cluster/JuiceFSStoragePage.tsx`。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01

## 设计目标与非目标

目标：三个页签共享一份卷数据；卷/用量/性能各自可解释（单位、空态、提示）；只读。
非目标：配额修改、benchmark、卷生命周期、跨集群视图、直连 Prometheus。

## 关键约束

- 卷与汇总走 `/kapis/juicefs.kubesphere.io/v1alpha1/{volumes,summary}`；成员集群的段在 kapis 与组名之间：`/kapis/clusters/<id>/juicefs.kubesphere.io/v1alpha1/...`（老 console 的 `apiPath` 就是这个顺序）。
- 性能走 `/kapis/monitoring.kubesphere.io/v1alpha3/cluster`，参数 `metrics_filter` / `start` / `end` / `step`。
- 卷接口无分页、无 fieldSelector；页面不做服务端筛选。
- 只读：不渲染任何写入口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01 — 复用平台 JuiceFS 聚合 API，不读 CRD、不直连 Prometheus

**为什么**：卷清单需要把 PV（配额）与客户端 statfs（实际用量）join 起来，还要带上 `mountedNodes`、`inodes`、`quotaDrift`——这些都不是某个单一对象里的字段。平台已经有这个聚合接口（老 console 用的就是它），B200 上实测 200 且返回 3 卷。性能走监控 API 而不是 Prometheus 直连：控制台没有 Prometheus 地址，且这层的指标名/鉴权已经封装好。
**被否方案**：页面自己列 PV + 逐个 mount pod 算 statfs。等于在浏览器里重写服务端 join，慢且容易算错。
**何时重新考虑**：聚合 API 下线，或需要它没有的字段（例如逐卷 IOPS 拆分）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-02 — 三个页签一个页面组件 + 页签状态，而不是三条路由

**为什么**：三个页签共享同一份卷清单，且新 console 的页面清单（registry）把一个页面当一个对象；拆三条路由会让侧栏与契约把三个页签当成三页，还要为「默认页签」再造一条重定向。页面内状态切换没有这个问题。
**被否方案**：照搬老 console 的 `/overview /volumes /performance` 子路由。老 console 用子路由是因为它的 router 按 Banner 页签生成链接；新 console 的导航模型不同。
**何时重新考虑**：页签需要深链接分享（例如告警里直接指向性能页签）时，再给每个页签加可选的查询参数。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-03 — 状态与创建时间由一次集群级 PV 读 join

**为什么**：JuiceFS 接口按 PV 名标识卷，但不重复 PV 的 `status.phase` 与 `metadata.creationTimestamp`。列表再加一次 PV 读（B200 上 0.5s、73 条）比后端改接口便宜，且它是集群级读，不受项目数影响。
**被否方案**：从 PVC 反查（claimRef 只给 claim，不保证有创建时间）；或者不显示这两列（用户要求有状态与创建时间）。
**何时重新考虑**：聚合 API 把 PV 元数据带进卷对象时，删掉这次读。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-04 — 指标单位在页面侧声明，累计计数器不展示

**为什么**：监控响应只有序列，没有单位。老 console 在这里踩过两次：吞吐用带宽单位换算会 8 倍偏大，延迟用毫秒会把秒值放大约 1000 倍。单位与指标一起写在 `PERFORMANCE_METRICS` 里，任何新增指标必须选一个 kind。
**被否方案**：把 `juicefs_cpu_usage` 也放进表格。实测该序列约 32000 且只增不减，是累计 CPU 秒，不是瞬时利用率；放进来会让读者以为 CPU 使用率是 32000%。
**何时重新考虑**：后端把该指标改成 rate，或指标响应带 unit 字段。

## 系统现状

老 console：`console/src/pages/clusters/containers/Storage/JuiceFS/`（Overview / Volumes+QuotaModal / Performance），store 在 `console/src/stores/juicefs.js`。它还有配额修改与 benchmark 两个写能力。本页只迁移只读视图，写能力见「明确不做」。新 console 的集群存储分组已有存储类型、持久卷、PVC、快照等页；JuiceFS 页是该分组里唯一需要聚合 API 的页面。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/JuiceFSStoragePage.tsx`
- 数据层：`apps/console-next/src/pages/cluster/juicefsQueries.ts`（接口、join、单位与格式化）
- 路由：`routes/kube-frontend.clusters.$cluster/juicefs-storage/{route,index}.tsx`
- 注册：`areas/registry.ts`（`juicefs-storage`，存储分组，已预置）
- 国际化：`packages/locales/src/index.ts` 新增 `cluster.juicefs.*` 键（中英同加；标题/描述原本已预置）
- 用例：`tests/ui/specs|tests/kube-frontend/cluster-management/`

## 对外契约

| 用途 | 路径 | 参数 |
| --- | --- | --- |
| 卷清单 | /kapis/juicefs.kubesphere.io/v1alpha1/volumes | 无（一次返回全部） |
| 汇总 | /kapis/juicefs.kubesphere.io/v1alpha1/summary | 无 |
| PV（状态/创建时间） | /kapis/resources.kubesphere.io/v1alpha3/persistentvolumes | limit=-1 |
| 性能趋势 | /kapis/monitoring.kubesphere.io/v1alpha3/cluster | metrics_filter, start, end, step, cluster |
| 成员集群前缀 | /kapis/clusters/<id>/juicefs.kubesphere.io/v1alpha1/... | 同上 |

`volumes` 每项字段：`name` / `path` / `parent?` / `storageClass` / `claimName` / `claimNamespace` / `capacityBytes` / `usedBytes` / `inodes` / `inodesUsed` / `mountedNodes[]` / `accessModes[]` / `metricsEnabled` / `quotaDrift`。

## 不变量

1. 卷页签的行数 = `volumes` 接口返回的条数（0 条显示空态）。
2. 三个页签读同一份卷清单，顺序一致，不各自请求。
3. 性能页的每个数值都按 `PERFORMANCE_METRICS` 里声明的单位格式化。
4. 页面只读：没有任何写请求。

## 已知坑

- **单位**：吞吐是字节/秒（不是 bit），延迟是秒（不是毫秒），`juicefs_cpu_usage` 是累计计数器（不展示）。
- **成员集群段顺序**：`/kapis/clusters/<id>/juicefs.kubesphere.io/...`，不是 resources 代理那种 `/kapis/<group>/clusters/<id>/...`。
- **volumes 字段在顶层**：`items[].name`，不是 `metadata.name`；照 Kubernetes 习惯读会全表空白。
- **卷名 = PV 名**：B200 上是静态 PV（`kubeaihub-*`），所以 join 能用名字；动态供应的 PV 名是 `pvc-<uid>`，若后端将来把卷名改成别的标识，join 会退化成 `-`（不报错）。
- **summary 的 `metricsEnabled`**：为 false 时性能页要直接说明，不要等一个永远不返回的序列。
- **locale 是追加**：只预置了 `title`/`description`，其余 40 个键由本功能点新增，中英必须同时加。
- **长时间窗的 step**：24h 用 15m，1h 用 60s，避免一次拉上千点。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01.yaml`
- 可观测点：`cluster-juicefs:surface`（`data-ai-state` 为 loading/ready/empty/error）、页签 `cluster-juicefs:tab:{volumes,usage,performance}`、内容区 `cluster-juicefs:{volumes,usage,performance}`、行句柄 `data-ai-row=<volume name>`、指标行 `cluster-juicefs:metric:<name>`、重试 `cluster-juicefs:retry`。
- 失败可从 DOM 读到错误面板与重试按钮。

## 后续改进

- 配额修改（`PUT /volumes/{name}`）与 benchmark，需要作业状态轮询与回滚提示。
- 性能页签支持按卷/实例拆分序列（当前每个指标一个序列）。
- 成员集群上的集成验证（本环境只有 host 集群）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01
