# 持久卷（L3）

[子模块需求](./_index.md)

## 概述

集群级持久卷列表：名称（副行为存储类型）、状态、容量、访问模式、绑定声明、回收策略、创建时间。

## 用户故事

### US1 - 判断一个持久卷被谁占用、释放后会怎样 (Priority: P1)

作为 **集群管理员**，我希望 **看到绑定声明与回收策略**，以便 **判断删除声明后数据会不会被一起删掉**。

**Independent Test**：打开持久卷页，核对某卷的绑定声明与回收策略同 `kubectl get pv` 一致。

### US2 - 弄清一个卷的数据会不会丢 (Priority: P1)

作为 **集群管理员**，我希望 **看到一个持久卷的回收策略与绑定关系**，以便 **在删除声明前知道数据是被保留还是被删除**。

**Independent Test**：从持久卷列表点进详情，核对回收策略、容量与绑定声明与该对象一致。

### US3 - 安全地清理不再需要的持久卷 (Priority: P2)

作为 **集群管理员**，我希望 **在控制台编辑卷的别名/描述、编辑 YAML，并在确认后删除不再需要的卷（批量删除时跳过仍被绑定的卷）**，以便 **不必转去 kubectl 做这些操作，同时不会被一个按钮误删正在使用的数据**。

**Independent Test**：打开 Available 卷详情，改别名/描述并保存后接口注解更新；编辑 YAML 改别名后接口同步；删除需输入卷名，确认后列表不再有该卷；Bound 卷的删除按钮置灰并显示原因；同时选中 Bound 与 Available 卷批量删除，结果汇总为成功 1、跳过 1，Bound 卷仍在。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01** — 已知集群存在持久卷，当打开持久卷页，则显示名称、状态、容量、访问模式、绑定声明、回收策略、创建时间七列；已绑定的卷其「绑定声明」形如 `<命名空间>/<声明名>`，未绑定的显示 `-`；行数等于核心 API 返回的数量。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02** — 已知集群中有持久卷，当点击其名称，则进入持久卷详情：显示状态、容量、访问模式、回收策略、存储类型、卷模式、挂载选项、创建时间，以及绑定的声明（未绑定时明确说明）；这些值与该持久卷对象一致。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03** — 已知持久卷详情页，当点「编辑信息」并修改别名/描述后确认，则发出只包含 metadata.annotations 的 merge-patch（未改动的注解保留，清空的注解以 null 移除），详情元数据区回显新值；当点「编辑 YAML」修改对象后确认，则整对象 PUT（带当前 resourceVersion）成功并刷新详情；服务端冲突或校验失败时对话框保持打开并显示错误。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-04** — 已知卷状态为 Bound/Released，当打开其详情或行操作菜单，则删除入口置灰（不可点击）并显示「先释放声明并确认后端数据处置」的说明；当卷状态为 Available 等可删状态并点删除，则弹出输入名称确认框，输入完全一致才可提交，确认后回到列表且该卷从接口与列表中消失。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-05** — 已知同时选中 Bound 与可删卷并点批量删除，当输入确认文本并提交，则只对可删卷发 DELETE，结果区显示「成功 N / 跳过 M（Bound / Released）/ 失败 K」的汇总；Bound 卷保持不变；全部被选卷都不可删时不发任何 DELETE，并说明「均不可删除」。

## 设计目标

把「这块存储现在归谁、释放后会不会被删除」放在同一行。

## 约束与边界

- 读核心 API `/api/v1/persistentvolumes`，不走 kapis 代理。
- **写能力分级**：编辑信息与编辑 YAML 已重纳（2026-11-17，N-11）；删除与批量删除同样重纳，但受状态约束——`Bound` / `Released` 的卷禁止删除，删除需输入名称确认（与老 console 一致）。
- 全量一次取回并在前端排序（集群内卷数量有限，接口又要 24 秒）。

## UI 交互设计

名称列第二行显示存储类型；状态用徽标（Bound 成功、Available 提示、其余警告）。

- 列表多选（行复选框、全选）；批量操作「批量删除」仅在有选择时出现。行操作菜单：编辑信息 / 编辑 YAML / 删除（Bound、Released 的删除置灰）。
- 存在不可删卷时表格上方显示说明条；删除确认输入卷名（批量输入数量）；批量结果在表格下方显示「成功 N / 跳过 M / 失败 K」。
- 详情页右上：编辑信息、编辑 YAML、删除；Bound/Released 时删除置灰并显示原因。

## 文案与校验

- 列：名称、状态、容量、访问模式、绑定声明、回收策略、创建时间。
- 未绑定：绑定声明显示 `-`。
- 删除保护：Bound / Released 显示「不可删除」原因；Available 等可删状态才允许删除。
- 批量结果：成功 / 跳过（Bound、Released）/ 失败分别计数；全部被跳过时说明「均不可删除」。

## 边界情况

- `spec.capacity.storage` 缺失时显示 `-`。
- 回收策略缺失时按 Kubernetes 默认 `Retain` 显示。

## 明确不做

- 创建持久卷（老 console 的集群存储页也没有创建入口；N-11 只重纳编辑与删除）。
- 查看卷内文件。

## 重纳能力（2026-11-17 产品复核）

原登记「创建、删除持久卷不做」，理由写在[技术方案](../../../design/kube-frontend/cluster-management/persistent-volumes.md)的 DEC-…-PERSISTENT-VOLUMES-03：卷通常是数据的唯一副本，删除是不可逆操作。**2026-11-17 产品复核决定重纳**（N-11，见[重纳决策记录](../../../docs/plans/reinclusion-decisions-20261117.md)）——不可逆不等于不提供入口，靠「控制台没有按钮」并不能防止误删，反而逼管理员直接敲 kubectl（那里连状态校验都没有）。

交付（2026-11-17，AC-03/04/05）：

1. 编辑信息（别名 / 描述注解，merge-patch，清空的键以 null 移除）、编辑 YAML（整对象 PUT，带 resourceVersion，冲突时保留输入）。
2. 单条删除与批量删除。Bound / Released 的卷不可删：单条入口置灰并说明原因，批量操作跳过不可删项并汇总「成功/跳过/失败」。
3. 删除确认需输入名称（破坏性操作按后果分级）。

## 假设

- 核心 API 与 kapis 返回同一批卷。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01** — 七列展示，绑定声明为 `<命名空间>/<名称>`。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-02** — 名称列可搜索、可排序。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03** — 详情与列表提供编辑信息、编辑 YAML、单条删除与批量删除。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-04** — Bound/Released 的卷禁止删除，单条置灰说明、批量跳过并汇总。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01** — 卷名集合与 `kubectl get pv` 一致。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-03** — 编辑信息/ YAML 后接口对象与页面同步；可删卷删除后从接口与列表消失；Bound 卷在单条与批量两条路径都不会被删除；批量汇总的计数与实际删除数一致。
