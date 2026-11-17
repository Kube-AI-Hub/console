# 集群网关（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-gateways.md)

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01
- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03

## 概述

ClusterGatewaysPage 共用两视图表格，clusterGatewaysApi 读取原生集合，
toClusterGateway 复用已有 toProjectGateway 的控制器就绪映射。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02 — 一个组件、两份 schema、两个存储键

集群网关页用同一个 `ResourceList` 渲染两个页签，schema 按 `component` 切换。列显隐因此必须：

- 两份 schema 各声明一份 `columnVisibility`（aiId 分别为 `cluster-gateways:cluster|project:columns`）；
- 活动 schema 由 `component` 派生，`useColumnVisibility` 的键带页签名（`cluster-gateways:<tab>`），
  否则在「集群网关」隐藏「命名空间」会连带隐藏「项目网关」的同名列。

### GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02 — 单行列定义与 rowActions 的坑

该文件里既有**多行**列定义、也有**单行**列定义（`{ key: 'ready', title: …, render: … }`），逐行补 `hideable`
的脚本只处理多行会漏掉一半（本批第一次只剩「重置」可见）。另外 `rowActions` 里的对象也有 `key:`，
批量加 `hideable` 会误加到 action 上并触发类型错误（`hideable` 不存在于 `ListAction`）——必须限定在
`columns: [` 块内。
## 系统现状

老版 gateways/cluster 与 gateways/project 是两个视图；新 UI 原来只有项目网关页。
本轮补集群入口及两个列表，保留真实状态；写能力和下钻监控仍登记为缺口。

## 仓库落点

- `apps/console-next/src/pages/cluster/ClusterGatewaysPage.tsx`
- `src/routes/kube-frontend.clusters.$cluster/gateways/{route,index,$component}.tsx`
- `packages/api-client/src/gateways.ts`

## 对外契约

GET `/apis/gateway.kubesphere.io/v1alpha1/gateways`，成员集群沿用 clusters 段。
原生 List 的 items 为全部对象，无 totalItems 不渲染分页。
句柄：`cluster-gateways:surface`、`:search`、`:refresh`、`:tab:cluster`、`:tab:project`。

## 设计目标与非目标

目标：集群入口、作用域区分与真实状态；写能力（创建/编辑/删除）已由 2026-11-17 重纳，见 DEC-…-CLUSTER_GATEWAYS-03，验收等控制器就绪。非目标：安装控制器与 ingress-nginx release。

## 关键约束

- 状态来自 Deployed=True，不以 spec.replicas 判断就绪。
- Gateway 读取错误必须抛出，不能吞掉异常返回空列表。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-04 — 集群网关只开放编辑，创建/删除留给安装器

**为什么**：集群网关是安装器 Helm release 的产物（命名空间 kubesphere-controls-system，名字沿用旧约定），删除它会直接移除集群入口控制器；新建第二个集群网关没有产品语义。编辑（类型/副本/追踪/NodePort）是管理员真实需要的操作，对话框与项目网关完全一致，直接复用避免两套表单。

**被否方案**：照搬老 console 的集群卡片创建/删除按钮。老页面删除按钮同样只在受控运维场景使用；新 UI 没有安装器上下文，误删代价是整个集群入口不可用。

**何时重新考虑**：平台提供集群网关安全删除（先迁移/确认入口）的明确流程时。



### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01 — 原生 List 只读盘点，不模拟分页或就绪

**为什么**：B200 服务 Gateway CRD 但控制器 chart 缺失；对象可读不表示底层网关就绪。
读取全集按作用域过滤并共享列表组件，比伪分页或创建一个不会部署成功的对象更符合数据事实。

**被否方案**：因控制器不完整而隐藏整个入口；这会丢失状态排障能力。吞掉接口错误显示暂无网关会误导管理员。

**何时重新考虑**：控制器安装完整并能验证部署、禁用、日志和监控后，迁移剩余写能力及下钻页。

> 2026-11-17 更正：这条「何时重新考虑」被产品复核提前触发——写能力与下钻页从「不做」改为**重纳 + 环境阻塞**（见下条 DEC）。原判断里「不模拟就绪」的部分仍然有效：未就绪就是未就绪，不因为有了写入口就显示可用。

## 不变量

1. 默认 cluster 视图，project 视图链接到所属项目的网关页。
2. 只有 Deployed=True 显示就绪；地址缺失显示 -。
3. 不给无总数的原生 List 配置分页器。

## 已知坑

- 集群网关和项目网关共享 Gateway CRD，区别不能用“有无对象”猜测。
- 原项目 Gateway API 吞掉读取异常，不能复用它的 get 作为集群错误判定。

## 测试与可观测

E2E 见 `tests/kube-frontend/cluster-management/`：读取真实集合，核对两视图数量与 URL。
映射和查询单测覆盖 Deployed 条件、集群归属、空列表与错误不吞掉。

## 后续改进

集群写操作与详情 4 页签已重纳（DEC-…-CLUSTER_GATEWAYS-03）；**环境就绪前不能把这些能力登记为已迁移**。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03 — 写能力重纳，验收等控制器（2026-11-17）

**新决定**：提供创建、编辑、删除集群网关。**2026-11-17 产品复核决定重纳**（N-29，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)），登记口径为**重纳 + 环境阻塞**。

**原判断（保留，不删除）**：PRD 曾登记「本轮不安装集群网关控制器，不创建、编辑或删除集群网关：部署环境缺控制器 chart，无法验证真实就绪」；本文件「后续改进」曾写「集群写操作…环境就绪前不能把这些能力登记为已迁移」。

**为什么当时判断错了**：把一条**环境限制**登记成了**产品决定不做**。这两件事的处置不同——环境限制是「等条件具备再验收」，产品不做是「永远不做」。按后者登记，会让控制器就绪之后也没有任何待办指向它。

**落地约定**：
1. 代码与规格可以推进；验收条件写明「控制器就绪后网关能创建到 Ready」，未就绪前不登记已迁移。
2. 创建/编辑的失败必须在弹窗内映射控制器返回的原因（纯文本正文也要保留），不能退化成「保存失败」。
3. 删除需输入名称确认；对象存在即可删，不等就绪。
4. 未就绪时列表与详情都必须显示「部署中」而不是「已就绪」——写入口的存在不改变就绪判据。

**何时重新考虑**：控制器 chart 就绪并跑通一次完整创建→就绪→删除后，把本条从「环境阻塞」改为「已交付」，并补验收证据链接。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03`
