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

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 已登录平台管理，当在集群列表点「添加集群」，对话框分为「基本信息」与「连接设置」两段；基本信息包含名称、别名、标签、供应商与描述（标签下拉含生产/开发/测试/演示四项，供应商可从七个预设中选或自行输入），连接设置包含连接方式与 kubeconfig；提交合法的名称与 kubeconfig 后创建出 `cluster.kubesphere.io/v1alpha1` 的 Cluster 对象，`spec.connection.type` 为 `direct`、`spec.connection.kubeconfig` 为 kubeconfig 的 base64、`spec.joinFederation` 为 `true`，所选标签写入 `cluster.kubesphere.io/group` 标签、供应商写入 `spec.provider`，列表中立即出现该集群。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02** — 已知填写了可选的别名与描述并选择「代理连接」，当提交，则对象的 `spec.connection` 只有 `type: proxy`（**没有 kubeconfig 键**），`kubesphere.io/alias-name` 与 `kubesphere.io/description` 注解等于填写值，列表行显示别名与对象名；该集群在部署代理前保持未就绪，状态列显示原因。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03** — 已知对话框已填写合法名称与结构完整的 kubeconfig，当校验或创建接口返回失败（400/409/5xx 或超时），则对话框保持打开、输入保留，`role="alert"` 的 `clusters:add-error` 展示可操作原因（jwtSecret 不一致、clusterRole 非法、API 不可达、名称冲突或内部错误），页面同时弹出失败通知，且未创建 Cluster 对象；服务端以 kube Status JSON（`{"kind":"Status","message":…}`）或纯文本回答时都能映射到同一套说明。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04** — 已知平台已存在名为 `host` 的集群，当在「集群名称」中输入 `host` 并使该字段失焦，则字段下方出现「已经有同名集群」的提示；修改名称后提示消失；该提示**不阻止提交**，创建请求仍会发出并由服务端裁决。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05** — 已知当前账号对 `clusters@cluster.kubesphere.io` 没有 `create` 权限，当打开集群列表，则「添加集群」主操作处于禁用态并在旁边说明缺少权限，点击不打开对话框；有权限时按钮可用。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06** — 已知用代理连接创建了集群且它尚未就绪，当打开该集群概览页并展开生成的 `agent.yaml`，则清单中 `cluster-agent` Deployment 的容器 `agent` 必须声明 `resources.limits.memory` 为 `2Gi`、`resources.requests.memory` 为 `100Mi`（CPU 为 limit `1` / request `100m`），使用二进制单位（`Gi`/`Mi`）而不是十进制（`G`/`M`）；该清单由 `GET /kapis/cluster.kubesphere.io/v1alpha1/clusters/<name>/agent/deployment` 生成，不经由前端拼装，因此同一平台上的任何成员集群看到的资源规格一致。

## 设计目标

接入是一个「一次性写对象」的动作：表单不要求用户理解 Cluster 对象结构，只要求两件事——叫什么、怎么连；顺带把别名与描述一次填好，避免接入后再走一次「编辑信息」。

## 约束与边界

- 只做**导入**已有集群；用 KubeKey 新建集群需要 kubekey API 与主机清单，不在本页范围。
- 写 `/apis/cluster.kubesphere.io/v1alpha1/clusters`（kapis 端点对写请求返回 400 `wrong resource GroupVersionKind`）。
- kubeconfig 以 `btoa` 编码后写入 `spec.connection.kubeconfig`。

## UI 交互设计

- 集群列表的**主操作**是「添加集群」，位于搜索框右侧；无 `clusters:create` 权限时禁用并说明原因。
- 点开后是对话框，分「基本信息」与「连接设置」两段（同一屏，不做多步向导）：
  - 基本信息：集群名称（失焦时向平台确认是否已被占用）、别名、标签（无 / 生产 / 开发 / 测试 / 演示）、供应商（七个预设可搜索，也可输入自定义值）、描述。
  - 连接设置：连接方式（直接 / 代理）；直接连接显示 kubeconfig 编辑器与「如何获取 kubeconfig?」文档链接，代理连接改为说明「提交后会立即出现、但在部署代理前不会就绪」。底部「取消 / 确认」。
- 代理连接不出现 kubeconfig 输入框（多一个输入框就是让读者填它不会发送的内容）。
- 代理连接未就绪时，概览页展示三步引导与生成的 `agent.yaml`；清单中的资源规格由平台决定，不由读者调整（见 AC-06）。
- 名称与 kubeconfig 在**发请求前**校验；校验失败时滚动到**第一个**出错的字段并把焦点放到它的控件上（kubeconfig 是编辑器，焦点落到可编辑区），确保错误信息不会被滚动区挡住。
- 服务端错误显示在对话框**顶部**的危险提示条（不卷到确认按钮下面），并弹出常驻失败通知；保留用户输入，不关闭对话框。
- 成功后关闭对话框、刷新列表，并弹出「集群 {name} 已接入」的成功通知。
- 危险提示条标题与正文对比度使用 `text-ai-danger` / `bg-ai-danger` token，窄屏（1024）下正文换行，不遮挡确认按钮。

## 文案与校验

- 名称：小写字母、数字与连字符，不能以连字符开头或结尾；否则提示「名称只能包含小写字母、数字与连字符…」。名称已被占用时提示「已经有同名集群了，请换一个名称。」
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
| `cluster.add.group` | 标签 | Tag | 环境分组下拉 |
| `cluster.add.nameExists` | 已经有同名集群了，请换一个名称。 | A cluster with this name already exists… | 名称预检命中 |
| `cluster.add.docLink` | 如何获取 kubeconfig? | How do I get a kubeconfig? | 连接设置的文档链接 |
| `cluster.add.created` | 集群 {name} 已接入，等待它就绪。 | Cluster {name} has been imported… | 创建成功通知 |
| `cluster.add.noPermission` | 当前账号没有接入集群的权限… | This account cannot import clusters… | 主操作禁用说明 |

## 边界情况

- 提交失败（无权限 / 名称冲突 / 结构非法 / 校验拒绝 / 5xx）：对话框保持打开，错误信息以 `role="alert"` 呈现，并弹出通知。
- 名称预检请求失败（网络/无权限）：静默跳过，不阻止填写；提交时仍由服务端裁决。
- 标签选「无」时不写 `cluster.kubesphere.io/group` 标签，而不是写空字符串。
- 接入的集群不会立刻 Ready：列表展示控制器给出的未就绪原因，属正常状态，不是接入失败。
- 校验接口返回英文原文时，对已知原因（jwtSecret、clusterRole、API 不可达、重复导入）映射为中文说明，同时保留原文作为次要细节。

## 明确不做

- 用 KubeKey 新建集群（需要主机清单与 kubekey API）。
- 多步向导：老 console 的两步是向导骨架带来的，八个字段不需要分页；改为同一对话框内两段。
- 移除集群、更新 kubeconfig（老 console 有，另立功能点）。
- 改写存量集群的供应商拼写：老 console 存过 `Aure Kubernetes Service`（源码拼写错误），新数据不再产生它，但既有对象保持原值。

## 假设

- 平台已启用多集群联邦（`joinFederation`），成员集群可与其通信。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05`
- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06`

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 集群列表提供「添加集群」主操作，提交后创建 Cluster 对象并刷新列表。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-02** — 名称与 kubeconfig 在发请求前校验，非法输入不产生请求；校验失败时第一个出错字段必须滚入可见区并获得焦点。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03** — 系统必须把校验或创建失败的原因展示在添加集群对话框内，并弹出通知；失败时不得关闭对话框、不得创建 Cluster 对象。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04** — 名称字段失焦时必须向平台确认是否已被占用，命中时给出提示；该提示不得阻止提交。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05** — 无 `clusters:create` 权限时主操作必须禁用并说明原因。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06** — 代理接入清单中 `cluster-agent` 的资源限制必须由平台生成且足够宽裕（内存 limit `2Gi`、request `100Mi`），避免成员集群在大规模并发代理读时因 OOM 断开隧道而整体不可达。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-01** — 通过界面的接入结果与直接写 Cluster 对象的结果一致（type/kubeconfig/joinFederation/group/provider）。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-03** — 对 jwtSecret 不一致的校验 400，对话框 `clusters:add-error` 在 3 秒内出现含 jwtSecret 的说明，列表中不存在该名称的 Cluster。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04** — 输入已存在的名称并失焦后，提示在 3 秒内出现；此时仍可提交，由服务端拒绝。
- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-05** — SSAR 拒绝时按钮 `disabled`，其旁的说明文字可读，且不发出任何创建请求。
