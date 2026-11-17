# 集群网关（L3）

[子模块需求](./_index.md)

## 概述

集群管理员可查看集群与项目网关的名称、归属、访问方式、地址和控制器消息。
页面提供只读盘点，不将未就绪对象解释为可以访问。

## 用户故事

### US1 - 判断集群与项目网关是否就绪 (Priority: P1)

作为 **集群管理员**，我希望 **查看不同作用域的网关状态**，以便 **判断路由是否具备访问入口**。

**Independent Test**：打开集群和项目网关两个视图，对账接口对象；无对象时显示空态，有对象时状态取控制器条件。

### US2 - 调整集群网关配置 (Priority: P2)

作为 **集群管理员**，我希望 **在不重建网关的情况下调整集群入口的类型、副本、追踪与 NodePort**，以便 **应对流量变化或排障，而不用动安装器**。

**Independent Test**：集群网关页签打开某行「编辑」，对话框预填当前配置；保存（可先不修改）成功后关闭；无权限时编辑入口隐藏。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02** — 已知集群网关页的「集群网关」与「项目网关」两个页签各自是多列表格，当点某个页签的「显示列」，则只列出该页签 schema 的可隐藏列（名称不可隐藏）；取消勾选后该页签表头立即消失，选择按页签分别持久化（`kube-frontend.columns.cluster-gateways:{cluster,project}`）、两个页签互不影响，「重置」恢复该页签全部列。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01** — 网关设置从集群侧栏可达；默认显示集群网关，切换项目网关更新 URL。列表显示名称、项目、状态、访问方式、地址、控制器消息和创建时间；状态以 Deployed 条件为准，空值为 -，无对象为空态，接口失败不伪装为无数据。两视图可刷新，项目链接到已有网关设置页。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03** — 已知 host 集群存在安装器创建的集群网关，当打开集群网关页「集群网关」页签，则每行在权限允许时提供「编辑」；点击打开复用项目网关的编辑对话框（带网关名），保存走 gateway PATCH，成功关闭并刷新，失败保留对话框与原因。集群网关页签**不提供创建/删除**：创建属于安装器的 Helm release，删除会移除集群入口控制器；项目网关页签保留既有编辑/删除。

## 设计目标

一个页面区分两个作用域，状态和控制器失败原因保持可见。

## 约束与边界

- 只读原生 Gateway 集合；集群网关为 kubesphere-system 命名空间的 kubesphere-router-kubesphere-system，其余对象属项目视图。
- 原生 List 不提供 totalItems，读取全集后本地搜索，不显示分页器。

## UI 交互设计

标题、两个页签、搜索、刷新和表格；加载给骨架，错误给重试，403 不给重试。
未就绪对象存在时每 5 秒更新控制器状态，背景刷新不会清空已有对象。

## 文案与校验

- `cluster.clusterGateways.*` 提供中英文文案；状态和地址标签复用项目网关词典。
- 非 cluster/project 子路径返回未找到，不显示错误作用域。

## 边界情况

- 本部署 API 可读但当前无对象，两个视图都显示空态。
- 控制器没有分配地址时显示 -；Deployed 未报告 True 时显示部署中。
- 403 与接口失败按错误呈现，不等同于没有网关。

## 明确不做

- 项目网关的写操作由既有项目网关页承接，本页只链接过去。
- 安装/升级 ingress-nginx release 属于安装流程，不在页面内提供。

## 重纳能力（2026-11-17 产品复核）

原登记「本轮不安装集群网关控制器，不创建、编辑或删除集群网关」「日志、监控和配置编辑仍是能力缺口」。**2026-11-17 产品复核决定重纳**（N-29，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)）。

**这是「重纳 + 环境阻塞」，不是「已可验收」**：

1. **集群网关编辑已交付**（复用项目网关对话框；无修改保存也可验证 PATCH 路径）。创建/删除**不提供**：集群网关由安装器 Helm release 创建，删除会移除集群入口控制器——这是职责边界，不是环境阻塞。
2. 详情 4 页签（监控 / 日志 / 资源状态 / 元数据）：见 [gateway-detail.md](./gateway-detail.md)。
3. 控制器未就绪时页面必须说明缺什么；不得把未就绪对象显示成可用，也不得把这几项标为已迁移。

交付（2026-11-17）：`AC-…-CLUSTER_GATEWAYS-03` + `TC-…-03`；详情页签仍按 gateway-detail.md 推进。

## 假设

- gateway.kubesphere.io/v1alpha1 服务可读；集群网关名称沿用旧版约定。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-02`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-03`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01** — 集群和项目网关只读列表，显示真实控制器状态。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_GATEWAYS-01** — 页面对象数量与相同作用域的 API 对象一致，失败不伪装为空态。
