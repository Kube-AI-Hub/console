# 集群显卡 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/gpu.md)

## 概述

集群显卡列表与单卡详情读同一组只读接口：`GET /kapis/gpu.kubesphere.io/v1alpha1/gpus` 与 `/gpus/stats`。列表取全量（`limit=-1`）后直接渲染；单卡详情用 UUID 过滤同一个集合取一条；顶部健康比例用 stats 的服务端汇总。页面不做健康判定、不做前端求和。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01

## 设计目标与非目标

**目标**：让运维一眼看出哪张卡不健康、属于哪台机器；列表与详情对同一张卡给出同一个结论；带单位的量有明确单位。

**非目标**：不做健康重新判定（判定属 HAMi device plugin，汇总属 gpu-agent）；不做写操作（摘卡 / 重置 / 模式切换）；不做跨集群聚合。

## 关键约束

- 数据只来自 `gpu.kubesphere.io/v1alpha1`；页面与 api-client 都不读节点注解，也不解析 `hami.io/node-nvidia-register`。
- HTTP 只在 api-client：`packages/api-client/src/gpu.ts` 的 `gpusApi` 是唯一入口。
- 列表一次取全（`limit=-1`）：行数必须等于接口 items 数；分页只会让「行数」变成「当前页行数」。
- 单卡详情用 `$name = uuid`，数据是 `GET /gpus?uuid=<u>` 的 `items[0]`。
- 显存源单位 MiB，展示换算 GiB 并带单位。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01 — 单卡详情复用列表接口的 UUID 过滤，不新增单卡路由

**为什么**：服务端只注册了 `GET /gpus`（`kube-server/pkg/kapis/gpu/v1alpha1/register.go`），`GET /gpus/<uuid>` 实测 404。旧 console 的单卡详情就是 `GET /gpus?conditions=nodeName=<node>,uuid=<uuid>` 后取 `items[0]`（`console/src/pages/clusters/containers/Nodes/Detail/GpuDetail/store.js`）。实测集群路径 `GET /gpus?uuid=<uuid>` 也返回同一条，并且**带 `nodeName`/`nodeIP`**（列表路径不是单机路径，但仍会附上节点上下文），所以详情页不需要再用第二个请求查节点，URL 也只需要一个参数（UUID）。

**被否方案**：让 BFF 或 kube-server 新增 `/gpus/<uuid>`。那需要改服务端并重新发布；而两个读法读的是同一个 cache，收益只是 URL 形状更「REST」，代价是一条跨仓库的改动链。

**被否方案**：详情页拉全表再在前端 `find(uuid)`。列表今天没有分页，但一旦分页（或集群变大后必须分页），详情就会漏；而且详情页无法在没有列表状态的情况下独立刷新。

**何时重新考虑**：服务端提供真正的单卡资源（CRD 或 `/gpus/<uuid>`）时，只改 `gpusApi.get`。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-02 — 健康比例取 `/gpus/stats` 的服务端汇总，不在前端对列表求和

**为什么**：stats 就是为概览设计的接口（`listGPUModelStats`：`{ total, healthy, "<vendor>-<model>": n }`），与列表读同一个 `clusterGPUCache`，两处不会各说各话。前端对列表求和只在「列表恰好是全量」时成立；一旦列表改为分页或加了过滤，求和会安静地只描述当前页——页面看起来仍然正常，数字却错了。这正是要避免的静默错误。

**被否方案**：`rows.filter(r => r.health).length`。少一次请求，但把「概览口径」绑在了「列表口径」上，分页/过滤一上线就错。

**被否方案**：用 `allocatable - capacity` 反推不健康卡数。只能得出「少了几张」，说不出是哪几张。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-03 — 健康是接口的布尔结论，页面只做映射

**为什么**：健康判定链是 device plugin（XID 事件）→ gpu-agent 汇总 → `hami.io/node-gpu-info` → cache → 接口。页面再做一次判定就是第三份实现，且会和调度器的判定打架。页面对 `health` 只做一个映射：`true → 健康（绿）`，`false → 亚健康（黄）`。

**被否方案**：按 `gpuMemoryUsed`/`gpuCoreUsed` 或 Prometheus ECC 指标「推断」健康。那是另一套判定。

## 系统现状

- 服务端：`kube-server/pkg/kapis/gpu/v1alpha1/` —— `handler.go` 的 `listGPUs`（集群列表 / 单机 `conditions=nodeName`）、`listGPUModelStats`（`/gpus/stats`）；`cache.go` 的 `clusterGPUCache`（node informer 去抖 2 秒刷新，5 分钟兜底）；`types.go` 的 `ClusterGPUDevice`。
- 数据链：HAMi device plugin 的 register 注解（逐设备 health）→ gpu-agent 汇总 → `hami.io/node-gpu-info` → `collectDevicesFromAnnotations` → cache。
- 旧 console：列表 `src/pages/clusters/containers/Nodes/Gpus/index.jsx`（概览 + 表格，UUID 链到 `/clusters/<c>/nodes/<node>/gpus/<uuid>/status`）、单卡 `.../Detail/GpuDetail`、store `src/stores/gpu.js`。
- 新控制台的节点详情已经就绪，因此节点列链接到 `/clusters/$cluster/nodes/$name`。

## 仓库落点

| 层 | 路径 |
| --- | --- |
| api-client | `packages/api-client/src/gpu.ts`（`gpusApi.list/get/stats`、`toGpuDevice`、`toGpuStats`） |
| 页面 | `apps/console-next/src/pages/cluster/GpusPage.tsx`、`GpuDetailPage.tsx`、`gpuFormat.ts` |
| 路由 | `apps/console-next/src/routes/kube-frontend.clusters.$cluster/gpus/{route,index,$name}.tsx` |
| 用例 | `tests/ui/{specs,tests}/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01.*` |

## 对外契约

| 用途 | 路径 | 说明 |
| --- | --- | --- |
| 列表 | `/kapis/gpu.kubesphere.io/v1alpha1/gpus?limit=-1&sortBy=nodeName&ascending=true` | `items[]` + `totalItems`；每项含 `nodeName`/`nodeIP` |
| 单卡 | `/kapis/gpu.kubesphere.io/v1alpha1/gpus?uuid=<uuid>` | 没有 `/gpus/<uuid>`；取 `items[0]`，空即不存在 |
| 汇总 | `/kapis/gpu.kubesphere.io/v1alpha1/gpus/stats` | `{ total, healthy, "<vendor>-<model>": n }` |

字段：`index`、`uuid`、`type`（型号）、`health`（bool）、`gpuMemoryTotal`/`gpuMemoryUsed`（MiB）、`gpuCoreTotal`/`gpuCoreUsed`（百分比）、`vgpuTotal`/`vgpuUsed`、`numa`、`deviceVendor`、`mode`、`nodeName`、`nodeIP`。

## 不变量

1. 列表行数等于接口 `items` 数；健康行数等于 `health:true` 条数——页面不对 `health` 做二次判定。
2. 单卡详情展示的 UUID = URL 参数 = 列表中被点行 UUID。
3. UUID 不在接口结果里时显示「这张显卡不存在」，不显示空白页。
4. 概览数字只来自 `/gpus/stats`；列表失败不拿统计兜底，统计失败不拿列表求和兜底。
5. 显存一律带单位展示（GiB）；总量为 0 显示 `-`。

## 已知坑

- **没有 `/gpus/<uuid>`**：`register.go` 只注册 `GET /gpus`，实测 `/gpus/<uuid>` 404。详情用 `uuid=` 过滤，别照抄其他资源的 `/resource/<name>` 形态。
- **`conditions=nodeName=…` 返回的条目没有 `nodeName`**：单机路径是旧 console 的兼容形态（`GPUDevice` 不带节点字段）；集群路径（本页用的 `uuid=`）才带 `nodeName`/`nodeIP`，详情页因此不需要第二个请求。
- **`health` 的来源有 `omitempty` 历史**：register 注解里 `health:false` 会以字段缺失的形式出现，解析时「缺失 = false」。本接口输出的是 bool，但 `toGpuDevice` 仍按 `=== true` 判定，避免同一条语义在两层被写成两种。
- **被摘的卡不会从列表消失**：device plugin 只把 `health` 改成 false，不删条目；所以「少一行」永远不会发生，症状是「行在、状态黄」。
- **`limit=-1` 才是全量**：接口默认分页（10 条），不传 `limit=-1` 时 15 张卡只回 10 张，行数验收会变成「第一页行数」。
- **GPU 接口没有 member-cluster 段**：`gpu.kubesphere.io` 注册在集群自己的 apiserver 上；旧 console 也把 `cluster` 从参数里剔除。本页的 `cluster` 只进 query key，不进 URL；目前只在 `host` 验证过，member cluster 是否需要前缀未验证（与 vGPU 模式页共用同一结论）。
- **MiB vs GiB**：接口 `gpuMemoryTotal=183359` 是 MiB（≈179 GiB），原样打印会被读成 MB/GB。
- **gpu-agent 挂掉时注解冻结**：接口只剩最后一次汇总，页面显示的是「最后一次已知状态」而不是实时状态；这是「单一汇总者」的代价，页面不提供「重新采集」按钮。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01.yaml`（spec 一文件一测试：`test_TC_L3_KUBE_FRONTEND_CLUSTER_MANAGEMENT_GPU_01.py`）。
- 可观测点：`cluster-gpus:surface`、`cluster-gpus:health`（`data-ai-total` / `data-ai-healthy` 暴露统计口径）、`cluster-gpus:row:<uuid>`（每行一个 `data-ai-row` 与 `data-ai-id`）、`gpu-detail:surface`、`gpu-detail:uuid`、`gpu-detail:health`、`gpu-detail:node`、`gpu-detail:memory`、`gpu-detail:core`、`gpu-detail:back`、`gpu-detail:missing`。
- 接口侧：`GET /gpus?limit=-1` 的 `totalItems` 与 `/gpus/stats` 的 `total` 应一致（同一 cache）。

## 后续改进

- 型号分组 / 健康环图（旧 console 概览里有；本版只保留比例与计数）。
- 按 `deviceVendor` / `status` 过滤：接口已支持（`status=healthy|unhealthy`、`deviceVendor`），页面暂不加，避免与「先看全量」冲突。
- 单卡监控：属于 `cluster-gpu/gpu-monitor` 模块（Prometheus 指标），不在本页。
- 若集群卡数增长到需要分页，概览继续用 stats、列表改分页即可（不变量 4 已经为此留好边界）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-01
