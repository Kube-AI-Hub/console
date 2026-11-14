# 节点列表（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/nodes.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06

## 概述

节点列表：名称/内网 IP、状态、角色、CPU、内存。

## 设计目标与非目标

落实「状态等于 Ready 条件」，提供节点终端、局部元数据写入和关联资源。非目标：节点排空、导入与 GPU 模式切换。

## 关键约束

- 集群级集合；`namespace` 为空串。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01 — 显示可分配量而不是使用率

**为什么**：可分配量来自 Node 对象本身，任何时候都能读到；使用率需要 metrics-server，共享集群上未必可用，且瞬时值不适合做「还剩多少」的判断依据。

**被否方案**：显示 CPU/内存使用率。需要额外接口与降级路径，首期不做。

**何时重新考虑**：metrics 接口稳定可用时，再增加使用率列并在不可用时优雅降级。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-02 — 关联资源独立读取，按页签延迟加载

**为什么**：容器组、事件与监控均有独立的数据来源，只有打开页签才请求。原生 Pod 查询使用 spec.nodeName 并跟随 continuation，
避免聚合列表忽略过滤条件或只显示第一页；事件同时过滤 Node 类型与名称。趋势复用 ClusterMonitorPage 的窗口和图表，不创建第二套绘图组件。

**被否方案**：四个页签都放出来，Pods 显示空表。空表会被读成「没有容器组」。

**何时重新考虑**：需要按节点排障容器时（那时应有按节点过滤的 Pod 查询）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05 — 节点协议独立适配，复用终端视图

**为什么**：nodes/exec 是主机权限入口，后端使用 JSON 消息，与原生容器 exec 的通道字节不兼容。
api-client 新 openNodeTerminalSession，只向共享 ExecConsoleDialog 提供 write/resize/close。
握手完成仍可能在创建节点访问 Pod，首次 stdout 才触发 ready；30 秒无输出会失败并关 socket。

**被否方案**：前端创建特权 Pod 再复用容器 exec，会改变授权语义；或复制旧 UI，会重复终端和会话逻辑。

**何时重新考虑**：后端更换节点访问协议时，仅替换传输适配，不改变视图与键盘行为。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06 — 标签与污点只做局部并发写入

**为什么**：节点大部分字段属于 kubelet。PATCH 仅写 labels 或 taints，并携带 resourceVersion。
删除标签使用 null，删除污点使用空数组；发生冲突保留输入，禁止静默覆盖新对象。

**被否方案**：拿旧节点对象整体 PUT，会触碰无关字段；无版本覆盖整份 taints，会丢失并行修改。

**何时重新考虑**：需要批量编辑节点污点时，设计批量事务和逐节点错误反馈。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-03 — 容量必须换算成可读单位

**为什么**：接口按对象原样返回 `255600m` / `3170330328Ki`，直接打印会得到「3083573052660 / 3170330328Ki」——同一个量两种单位，看起来像 bug。
CPU 换算成核（1 位小数），内存与存储换算成 GiB/TiB，pods 显示整数。

**被否方案**：显示原始字符串并加 tooltip。读者要的不是原值，是能比较的量级。

**何时重新考虑**：需要精确字节数用于容量规划时（那时提供切换）。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-04 — 停止调度是行操作，不弹确认

**为什么**：cordon 可逆、不驱逐任何运行中的容器组，只阻止新调度。加确认框会让一件安全操作变得像危险操作，久而久之读者对确认框麻木。
反馈由状态列的「已停止调度」承担，且列表会 invalidate 重取——不是页面记住一次点击。

**被否方案**：弹窗确认。可逆操作不需要二次确认。

**何时重新考虑**：平台提供「排空」（驱逐容器组）时，那才是危险操作，需要确认。

## 系统现状

老 console 节点列含状态、角色、GPU、CPU/内存使用率、版本等；本模块取状态、角色、可分配 CPU/内存。

## 仓库落点

- `pages/cluster/ClusterListPage.tsx`（nodes 分支）
- `packages/api-client/src/storage.ts` 的 `toNodeSummary` / `nodeStatus` / `nodeRole`
- `NodeDetailPage.tsx`、`NodeMetadataDialog.tsx`、`NodeResourcesPanel.tsx` 与共享 `ClusterMonitorPage.tsx`
- `api-client/src/node-terminal.ts`、`node-resources.ts`、`cluster.ts`
- `server/src/upgrade.ts` 仅额外允许版本化 nodes/exec，不允许任意 kapis 升级。
- 后端参考 `kube-server/pkg/kapis/terminal/v1alpha2` 与 `pkg/models/terminal`；本批不更改后端实现。

## 对外契约

### CON-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05 — 节点终端

GET `/kapis/terminal.kubesphere.io/v1alpha2/[clusters/<cluster>/]nodes/<node>/exec`；
子协议 binary.k8s.io，token 经 bearer 子协议由 BFF 转 Authorization，不放进 URL。
stdin 为 `{Op:"stdin",Data}`；resize 为 `{Op:"resize",Cols,Rows}`；
stdout 的 Data 原样交给 xterm，toast 报错并关闭连接。远端 shell 由后端选择。

标签、污点与调度 PATCH `/api/v1/[clusters/<cluster>/]nodes/<node>`。
Pod GET 原生集合，fieldSelector=spec.nodeName；事件 GET /events，fieldSelector=involvedObject.kind=Node,involvedObject.name。
节点趋势 GET monitoring v1alpha3 `/nodes/<node>`，指标 CPU/内存用量与总量按时间戳相除、乘 100；容器组数为整数。

## 不变量

状态等于 Ready 条件；角色缺省 `worker`。

## 已知坑

- 没有 Ready 条件的节点（刚接入）不能当作 Ready。
- 角色标签可能有多个，用逗号连接。
- 节点访问 Pod 未启动前 WebSocket 可以已经打开，不能仅以握手成功判定可输入。
- Ubuntu 的 /bin 为符号链接，readline 的尾斜杠补全可能不同；真实补全验证使用 /usr 目录。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`；单测覆盖 `nodeStatus` / `nodeRole`。

## 后续改进

GPU 模式切换、节点导入、RDMA 端口与 GPU 拓扑仍未在本批交付。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06`

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-NODES-02 — 用量列显示**百分比**，容量放在 title 里

**为什么**：老 console 的节点列表显示使用率，而第一版迁移只显示了可分配量（`127600m`）——那是容量，不是"现在多忙"。改为 `metrics.k8s.io` 的当前用量 ÷ 可分配量，绝对数值放进 `title`，需要时悬停可见。

**单位换算必须显式做**：指标返回 `9983741666n`（纳核），容量是 `127600m`（毫核）。直接相除会得到几百万倍的数字。`quantityToNumber` 统一换算，并有单测覆盖 `n`/`m`/`Ki`/`Gi`。

**被否方案**：显示原始字符串。读者要自己换算，且两个数字的单位不同时根本无法比较。

**何时重新考虑**：需要历史趋势时（改为图表，需要监控接口的时间序列）。
