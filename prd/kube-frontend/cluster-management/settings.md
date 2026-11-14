# 集群设置（L3）

[子模块需求](./_index.md)

## 概述

集群的可编辑属性。当前只有**描述**一个字段可写；供应者、Kubernetes / Kube AI Hub 版本、连接方式、API 端点与节点数由安装器写入，在本页只读展示。

描述保存在集群对象的注解 `kubesphere.io/description` 上，同一个值也显示在集群概览页。

## 用户故事

### US1 - 修改集群描述 (Priority: P1)

作为 **平台管理员**，我希望 **直接修改集群描述**，以便 **在概览页说明这个集群的用途，而不必去改 YAML**。

**Independent Test**：打开集群设置，点「编辑描述」，改文案后保存，然后重新读取集群对象，核对注解已更新且概览页显示新文案。

### US2 - 清空描述 (Priority: P2)

作为 **平台管理员**，我希望 **能把描述清空**，以便 **去掉过期或不再准确的说明**。

**Independent Test**：清空描述并保存，重新读取集群对象，核对 `kubesphere.io/description` 注解**不再存在**（不是留空串）。

### US3 - 明确哪些字段不能在这里改 (Priority: P2)

作为 **平台管理员**，我希望 **版本与连接信息以只读形态展示并说明原因**，以便 **不会在页面上找不存在的编辑入口**。

**Independent Test**：打开集群设置，核对只读区列出供应者、版本、连接方式、API 端点、节点数，且没有编辑控件。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01** — 已知已登录且对集群有写权限，当在集群设置里把描述改为新值并保存，则页面显示新描述与「已保存」，且集群对象的 `kubesphere.io/description` 注解等于新值；只读区列出供应者、Kubernetes 版本、Kube AI Hub 版本、连接方式、API 端点与节点数。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-02** — 已知集群对象带有描述注解，当把描述清空并保存，则集群对象上该注解被**删除**（而不是留成空字符串），页面显示 `-`。

## 设计目标

1. 只把确实可写的字段做成可编辑，其余明确标注只读——不给出会失败的入口。
2. 保存失败时保留用户输入，并在原处说明原因。
3. 清空与「未修改」必须是两种不同的请求结果。

## 约束与边界

- 写入走 `/apis/cluster.kubesphere.io/v1alpha1/clusters/<id>` 的 merge patch；kapis 端点对该对象返回 400 `wrong resource GroupVersionKind`（实测）。
- 描述只写注解，不触碰 spec。
- 不提供集群可见性、分组标签、region/zone 编辑：这些由安装器或平台侧维护。

## UI 交互设计

- 描述面板：默认显示当前值（空值显示 `-`）与「编辑描述」按钮；进入编辑态后是文本域 + 保存/取消。
- 保存成功后退出编辑态并显示「已保存」；失败则停留在编辑态并显示错误。
- 只读区与描述面板分开，避免误以为整块都可编辑。

## 文案与校验

- 空白描述按「清空」处理（trim 后为空即删除注解）。
- 只读区平台版本标签为「Kube AI Hub 版本」，locale key 为 `cluster.settings.productVersion`，数值仍读 `status.kubeSphereVersion`。
- 保存中禁用保存/取消，避免重复提交。

## 边界情况

- 描述原本为空：面板显示 `-`，编辑从空开始。
- 保存时注解写入失败：显示错误，输入保留。
- 集群对象读取失败：错误面板 + 重试。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01** — 描述可编辑，保存写入 `kubesphere.io/description` 注解。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-02** — 清空描述时以 merge patch 的 `null` 删除注解。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-03** — 安装器维护的字段只读展示并说明。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01** — 保存后的注解值与页面显示一致；清空后注解不存在；概览页与设置页显示同一描述。

## 明确不做

- 集群可见性与分组标签编辑：安装器字段，改动会与安装配置产生分歧。
- region / zone 编辑：需要平台 regionZones 配置，当前环境没有。
- 删除集群、上下线集群：属平台侧编排，不在集群设置范围。

## 假设

- 集群对象允许以 merge patch 修改注解（实测返回 200）。
- 读回走 kapis，与列表页同源。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-SETTINGS-01
