# 添加集群（L3）

[子模块需求](./_index.md)

## 概述

在平台集群列表（`/kube-frontend/clusters`）上，用成员集群的 kubeconfig 把一个已有的
Kubernetes 集群接入本平台；接入后该集群出现在列表中，可直接进入其控制台。

## 用户故事

### US1 - 把已有集群接入平台 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表里粘贴成员集群的 kubeconfig 完成接入**，以便 **在不离开控制台的情况下把新集群纳入管理**。

**Independent Test**：在集群列表点「添加集群」，填入名称与 kubeconfig 并确认；列表中应出现该集群，且集群对象中存在 base64 编码的 kubeconfig。

### US2 - 接入时就填好别名与描述 (Priority: P2)

作为 **平台管理员**，我希望 **在接入时顺便起一个好认的别名并写一句描述**，以便 **列表与切换器里显示的是我认得出的名字，而不是对象名**。

**Independent Test**：用代理连接创建一个带别名与描述的集群，回读注解与列表行。

### US3 - 接入失败时看见失败原因 (Priority: P1)

作为 **平台管理员**，我希望 **校验或创建失败时在添加集群对话框里看到服务端原因，并弹出通知**，以便 **当场改正 kubeconfig、网络或成员集群配置，而不是只看到「失败」或「网络异常」**。

**Independent Test**：提交一段结构合法但校验被拒绝的 kubeconfig（例如 jwtSecret 不一致的 400 原文），对话框保持打开，`clusters:add-error` 出现可操作说明，列表中不出现该集群。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 已登录平台管理，当在集群列表点「添加集群」并提交合法的名称与 kubeconfig，则创建出 `cluster.kubesphere.io/v1alpha1` 的 Cluster 对象，`spec.connection.type` 为 `direct`、`spec.connection.kubeconfig` 为 kubeconfig 的 base64、`spec.joinFederation` 为 `true`，且列表中立即出现该集群。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02** — 已知填写了可选的别名与描述并选择「代理连接」，当提交，则对象的 `spec.connection` 只有 `type: proxy`（**没有 kubeconfig 键**），`kubesphere.io/alias-name` 与 `kubesphere.io/description` 注解等于填写值，列表行显示别名与对象名；该集群在部署代理前保持未就绪，状态列显示原因。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03** — 已知对话框已填写合法名称与结构完整的 kubeconfig，当校验或创建接口返回失败（400/409/5xx 或超时），则对话框保持打开、输入保留，`role="alert"` 的 `clusters:add-error` 展示可操作原因（jwtSecret 不一致、clusterRole 非法、API 不可达、名称冲突或内部错误），页面同时弹出失败通知，且未创建 Cluster 对象。

## 设计目标

接入是一个「一次性写对象」的动作：表单不要求用户理解 Cluster 对象结构，只要求两件事——叫什么、怎么连；顺带把别名与描述一次填好，避免接入后再走一次「编辑信息」。

## 约束与边界

- 只做**导入**已有集群；用 KubeKey 新建集群需要 kubekey API 与主机清单，不在本页范围。
- 写 `/apis/cluster.kubesphere.io/v1alpha1/clusters`（kapis 端点对写请求返回 400 `wrong resource GroupVersionKind`）。
- kubeconfig 以 `btoa` 编码后写入 `spec.connection.kubeconfig`。

## UI 交互设计

- 集群列表的**主操作**是「添加集群」，位于搜索框右侧。
- 点开后是对话框：连接方式（直接 / 代理）、集群名称、别名、供应商、描述；直接连接另有 kubeconfig 多行文本框。底部「取消 / 确认」。
- 代理连接不出现 kubeconfig 输入框（多一个输入框就是让读者填它不会发送的内容），并说明「提交后会立即出现、但在部署代理前不会就绪」。
- 名称与 kubeconfig 在**发请求前**校验；服务端错误显示在对话框**顶部**的危险提示条（不卷到确认按钮下面），并弹出常驻失败通知；保留用户输入，不关闭对话框。
- 成功后关闭对话框并刷新列表。
- 危险提示条标题与正文对比度使用 `text-ai-danger` / `bg-ai-danger` token，窄屏（1024）下正文换行，不遮挡确认按钮。

## 文案与校验

- 名称：小写字母、数字与连字符，不能以连字符开头或结尾；否则提示「名称只能包含小写字母、数字与连字符…」。
- kubeconfig：必须同时包含 `apiVersion`、`clusters`、`server`；否则提示「这段内容不像 kubeconfig…」。
- 两者都是**结构检查**，不解析 YAML：目的是拦住粘贴错文档，而不是校验 kubeconfig 是否可用。
- 服务端失败标题：`cluster.add.errorTitle`（添加集群失败 / Could not add the cluster）。
- 已知校验原文映射：jwtSecret 不一致、clusterRole 非法、平台 API 不可达、重复导入、名称冲突、内部错误。

| key | 中文 | 英文 | 用途 |
| --- | --- | --- | --- |
| `cluster.add.errorTitle` | 添加集群失败 | Could not add the cluster | 对话框提示条与通知标题 |
| `cluster.add.errorJwt` | 主集群与成员集群的 jwtSecret 不一致… | The host and member jwtSecret values do not match… | 校验 400 含 Jwt is not equal |
| `cluster.add.errorClusterRole` | 成员集群的 clusterRole 必须是 host 或 member… | The member cluster's clusterRole must be host or member… | 校验 400 含 clusterRole must be |
| `cluster.add.errorUnreachable` | 主集群无法连通 kubeconfig 中的 API 地址… | The host cluster cannot reach the API address… | 超时 / connection refused |
| `cluster.add.errorInternal` | 校验接口返回内部错误… | Cluster validation failed internally… | 空 5xx 或 Internal Server Error |

## 边界情况

- 提交失败（无权限 / 名称冲突 / 结构非法 / 校验拒绝 / 5xx）：对话框保持打开，错误信息以 `role="alert"` 呈现，并弹出通知。
- 接入的集群不会立刻 Ready：列表展示控制器给出的未就绪原因，属正常状态，不是接入失败。
- 校验接口返回英文原文时，对已知原因（jwtSecret、clusterRole、API 不可达、重复导入）映射为中文说明，同时保留原文作为次要细节。

## 明确不做

- 用 KubeKey 新建集群（需要主机清单与 kubekey API）。
- 移除集群、更新 kubeconfig（老 console 有，另立功能点）。

## 假设

- 平台已启用多集群联邦（`joinFederation`），成员集群可与其通信。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 集群列表提供「添加集群」主操作，提交后创建 Cluster 对象并刷新列表。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02** — 名称与 kubeconfig 在发请求前校验，非法输入不产生请求。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03** — 系统必须把校验或创建失败的原因展示在添加集群对话框内，并弹出通知；失败时不得关闭对话框、不得创建 Cluster 对象。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 通过界面的接入结果与直接写 Cluster 对象的结果一致（type/kubeconfig/joinFederation）。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03** — 对 jwtSecret 不一致的校验 400，对话框 `clusters:add-error` 在 3 秒内出现含 jwtSecret 的说明，列表中不存在该名称的 Cluster。
