# 集群列表 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-list.md)

## 概述

平台级集群列表：读 kapis 集群集合，映射为行；名称链接进该集群的概览。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-02

## 设计目标与非目标

目标：一屏回答「有哪几个集群、哪个不能用」；名称即入口。

非目标：集群注册/注销、跨集群聚合指标。

## 关键约束

- `GET /kapis/cluster.kubesphere.io/v1alpha1/clusters`
- 平台级路径 `/kube-frontend/clusters`，与 `/kube-frontend/clusters/<id>/…` 并列。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-CLUSTER_LIST-01 — 与集群概览读同一接口

**为什么**：概览页读 `/kapis/cluster.kubesphere.io/v1alpha1/clusters/<id>`，列表读同一集合。若列表改走 `resources` 代理，两页对「有哪些集群」可能给出不同答案——B200 上代理曾漏掉新建对象。

**被否方案**：列表走代理以复用 `resourceApi`。省几行，换来可能与详情页不一致。

**何时重新考虑**：代理与原生组被证明一致。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-CLUSTER_LIST-02 — 就绪徽标必带原因

**为什么**：「未就绪」本身不可行动。控制器的条件消息（`status.conditions[Ready].message`）是唯一说明，列表行里同屏显示。

**被否方案**：只显示徽标，原因留给详情页。多一次跳转才能知道要不要处理。

**何时重新考虑**：条件消息长度超出单元格可读范围时（改为 tooltip-only）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-CLUSTER_LIST-03 — 路径与按集群的控制台并列

**为什么**：`/kube-frontend/clusters` 是「有哪些集群」，`/kube-frontend/clusters/<id>/…` 是「某个集群里有什么」。前者是后者的目录，URL 形状与老 console 一致（老 console 的 `/clusters` 就是列表）。

**被否方案**：`/kube-frontend/clusters/list`。多一段没有语义的路径，且与老 console 的书签不兼容。

**何时重新考虑**：需要把列表放进某个功能区页签时。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-CLUSTER_LIST-04 — 角色来自标签，主集群置顶

**为什么**：主集群由联邦写入的 `cluster-role.kubesphere.io/host` 标签标识，不是名字（成员集群完全可能也叫 `host`）。
主集群是平台自身所在，读者默认先找它，因此默认排序下置顶；显式选择了其它排序（按时间、按节点数）时不再干预。

**被否方案**：用名称判断主集群。名字是用户可给的，不可靠。

**何时重新考虑**：平台支持多个主机群时（当前不支持）。

### DEC-L3-KUBE-FRONTEND-CLUSTER-MANAGEMENT-CLUSTER_LIST-05 — 刷新放在工具栏，做成通用能力

**为什么**：集群就绪状态会在读者不操作时改变（刚接入、刚掉线）。没有刷新入口时，唯一办法是重载整页，而人多半不会重载，只会以为「没变化」。
实现放在 ai-kit 的 `ListSchema.refresh`（可选），任何需要「不自变的列表」都能用，而不是每个页面各写一个按钮。

**被否方案**：定时轮询。对不常变的集合是浪费，且会让「看到的就是最新的」变成假设。

**何时重新考虑**：有真实的实时推送通道时。

## 系统现状

老 console 的平台管理 → 集群 指向 `/clusters`，列表列为名称、状态、版本、节点数、创建时间，并链接到该集群。本页与之对齐；顶部菜单的「集群」入口此前指向一个没有路由的地址，本页是它的落点。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/MultiClusterListPage.tsx`
- 路由：`apps/console-next/src/routes/kube-frontend.clusters.index.tsx`
- 接口：`packages/api-client/src/cluster.ts` 的 `clustersApi` / `toClusterSummary`
- 文案：`packages/locales/src/index.ts`（`cluster.list.*`）
- 导航：`shell/AppShell.tsx` 的 `MODULES.platform.children.clusters`（已存在，指向本页）

## 对外契约

`GET /kapis/cluster.kubesphere.io/v1alpha1/clusters`

## 不变量

1. 行数等于接口返回的集群数。
2. 就绪只认 `Ready` 条件的 `True`；`spec.enable: false` 优先显示「已停用」。
3. 名称链接目标是该集群的概览页。

## 已知坑

- **平台级路径没有集群段**：`/kube-frontend/clusters` 与 `/kube-frontend/clusters/<id>` 是两条不同路由；写成后者会 404。
- **`spec.enable` 与 `Ready` 是两件事**：停用的集群仍可能 Ready，显示时以后者优先。
- **只有 1 个集群不是空态**：空态只用于 0 条。

## 测试与可观测

用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01.yaml`
可观测点：`clusters:surface`、`clusters:search`、`data-ai-row=<cluster name>`。

## 后续改进

- 集群注册与注销（需平台注册接口）。
- 每个集群的节点/用量摘要列。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-01
