# 添加集群（L3）

[子模块需求](./_index.md)

## 概述

在平台集群列表（`/kube-frontend/clusters`）上，用成员集群的 kubeconfig 把一个已有的
Kubernetes 集群接入本平台；接入后该集群出现在列表中，可直接进入其控制台。

## 用户故事

### US1 - 把已有集群接入平台 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表里粘贴成员集群的 kubeconfig 完成接入**，以便 **在不离开控制台的情况下把新集群纳入管理**。

**Independent Test**：在集群列表点「添加集群」，填入名称与 kubeconfig 并确认；列表中应出现该集群，且集群对象中存在 base64 编码的 kubeconfig。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 已登录平台管理，当在集群列表点「添加集群」并提交合法的名称与 kubeconfig，则创建出 `cluster.kubesphere.io/v1alpha1` 的 Cluster 对象，`spec.connection.type` 为 `direct`、`spec.connection.kubeconfig` 为 kubeconfig 的 base64、`spec.joinFederation` 为 `true`，且列表中立即出现该集群。

## 设计目标

接入是一个「一次性写对象」的动作：表单不要求用户理解 Cluster 对象结构，只要求两件事——叫什么、怎么连。

## 约束与边界

- 只做**导入**已有集群；用 KubeKey 新建集群需要 kubekey API 与主机清单，不在本页范围。
- 写 `/apis/cluster.kubesphere.io/v1alpha1/clusters`（kapis 端点对写请求返回 400 `wrong resource GroupVersionKind`）。
- kubeconfig 以 `btoa` 编码后写入 `spec.connection.kubeconfig`。

## UI 交互设计

- 集群列表的**主操作**是「添加集群」，位于搜索框右侧。
- 点开后是对话框：集群名称、kubeconfig（多行文本框），底部「取消 / 确认」。
- 名称与 kubeconfig 在**发请求前**校验；服务端错误显示在对话框内，保留用户输入。
- 成功后关闭对话框并刷新列表。

## 文案与校验

- 名称：小写字母、数字与连字符，不能以连字符开头或结尾；否则提示「名称只能包含小写字母、数字与连字符…」。
- kubeconfig：必须同时包含 `apiVersion`、`clusters`、`server`；否则提示「这段内容不像 kubeconfig…」。
- 两者都是**结构检查**，不解析 YAML：目的是拦住粘贴错文档，而不是校验 kubeconfig 是否可用。

## 边界情况

- 提交失败（无权限 / 名称冲突 / 结构非法）：对话框保持打开，错误信息以 `role="alert"` 呈现。
- 接入的集群不会立刻 Ready：列表展示控制器给出的未就绪原因，属正常状态，不是接入失败。

## 明确不做

- 用 KubeKey 新建集群（需要主机清单与 kubekey API）。
- 移除集群、更新 kubeconfig（老 console 有，另立功能点）。

## 假设

- 平台已启用多集群联邦（`joinFederation`），成员集群可与其通信。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 集群列表提供「添加集群」主操作，提交后创建 Cluster 对象并刷新列表。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02** — 名称与 kubeconfig 在发请求前校验，非法输入不产生请求。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 通过界面的接入结果与直接写 Cluster 对象的结果一致（type/kubeconfig/joinFederation）。
