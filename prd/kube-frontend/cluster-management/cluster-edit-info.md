# 编辑集群信息（L3）

[子模块需求](./_index.md)

## 概述

在集群列表上修改一个集群的**别名、标签、供应商与描述**。集群名称由平台创建，不可修改。

## 用户故事

### US1 - 给集群起一个读得懂的名字 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表直接编辑集群的别名与说明**，以便 **在多个集群之间分辨它们而不必记住对象名**。

**Independent Test**：在列表对某集群点「编辑信息」，修改别名/标签/供应商/描述并确认；读回集群对象，四个字段都变了；清空别名后读回，别名注解消失。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01** — 已登录平台管理，当在集群列表对某集群提交新的别名、标签、供应商与描述，则集群对象的 `kubesphere.io/alias-name`、`cluster.kubesphere.io/group`、`spec.provider`、`kubesphere.io/description` 随之更新，且列表中该行的名称列显示别名、副行显示对象名。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-02** — 当把别名/标签/描述清空后提交，则对应的注解与标签键**被删除**（而不是保留旧值）。

## 设计目标

四个字段都能在列表上改完，不必进入集群再找设置页。

## 约束与边界

- 集群名称只读：它是对象标识，被 URL 与联邦引用。
- 只改这四项；连接信息、模块、地址属于安装器的职责。
- 写走 merge patch（`application/merge-patch+json`），清空必须发 `null`。

## UI 交互设计

- 行操作「编辑信息」打开对话框：名称（禁用，带「对象标识不可修改」说明）、别名、标签（下拉）、供应商（可搜索下拉）、描述。
- **四个可写字段与「添加集群」共用同一组件**（`ClusterIdentityFields`）：同一套标签选项（无/生产/开发/测试/演示）、同一套供应商选项（八个，可搜索），提示文案也一致。两个对话框各写一份是它们此前开始漂移的原因（编辑信息的标签缺「演示」，供应商是自由文本 + `<datalist>`）。
- 保存后关闭对话框、刷新列表，并弹出「已保存」通知；失败时对话框保留输入并在**顶部**显示错误条（与添加集群同一位置，长表单不会把错误卷到确认按钮下面）。

## 文案与校验

- 别名 ≤ 63 字符；描述 ≤ 256 字符。
- 标签在 production / development / testing / demo 与「无」之间选择，与「添加集群」完全相同。
- 供应商从八个预设中选择，也接受任意输入。

## 边界情况

- 清空别名：注解键被删除，列表回落到显示对象名。
- 无权限：入口不显示；后端拒绝时对话框内提示。

## 明确不做

- 修改集群名称、连接方式、kubeconfig（后者属「更新 kubeconfig」独立功能）。
- 移除集群。

## 假设

- 集群对象的注解与标签可写（平台管理员）。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01** — 列表行操作提供「编辑信息」，四个字段写回集群对象。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-02** — 清空字段删除对应注解/标签。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_EDIT_INFO-01** — 界面保存结果与直接 patch 对象的结果一致。
