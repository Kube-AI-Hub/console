# 服务与应用路由创建（L3）

[子模块需求](./_index.md)

## 概述

服务与应用路由两个列表页提供「创建」：服务表单填名称、类型、端口、选择器，应用路由表单填名称与一组「域名 + 路径 → 后端服务端口」规则。列表页头部的创建按钮是页面唯一的主动作，始终可见。

这是对已有通用清单创建弹窗的收窄与补齐：通用弹窗只有一个端口、一条路由规则，且无法表达 NodePort 的节点端口；新建表单把这两处补上，并保留切换 YAML 的路径（多端口、TLS、高级字段）。老 console 的创建入口在服务与应用路由列表页，新 UI 在此补齐。

## 用户故事

### US1 - 建一个能被节点访问的服务 (Priority: P1)

作为 **项目运维**，我希望 **在服务列表直接创建 NodePort 服务，端口指到容器的 8080、选择器从已有工作负载的 app 标签里选**，以便 **不必先写 YAML 就能把工作负载暴露到节点端口**。

**Independent Test**：创建一个带唯一 app 标签的部署，再创建 NodePort 服务（8080→80，选择器选该标签），回读 `spec.type`、`spec.selector`、`spec.ports` 与输入一致，节点端口由集群分配。

### US2 - 一条域名下配多条路径 (Priority: P1)

作为 **项目运维**，我希望 **创建一个应用路由，并在同一域名下增删多条路径、分别指向服务端口**，以便 **不必为每个路径单独建一个路由对象**。

**Independent Test**：创建路由时填两条同一域名的路径（/api→8080、/static→命名端口），回读 `spec.rules` 只有一条 host 规则、两条 `http.paths`。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01** — 已知一个部署带着唯一的 app 标签，当在服务列表点「创建」并选择 NodePort 类型，则节点端口字段出现；填名称、8080→80、选择器选该标签并提交后，回读 `spec.type=NodePort`、`spec.selector={app: 标签}`、`ports[0]` 为 8080→80 且 `nodePort` 由集群分配；当用同一名称再次提交，则弹窗不关闭且错误提示包含「已存在」；当在应用路由列表创建一条域名规则、新增第二条规则后删除再新增并按同一域名填写路径 /static，则回读 `rules` 只有一条该域名的规则、两条路径分别指向数字端口与命名端口。

## 设计目标

1. **表单覆盖常用创建**：服务类型、条件字段（NodePort 才有节点端口）、选择器预填；路由支持多规则增删。
2. **不丢输入**：服务端拒绝（同名、权限、非法字段）时弹窗保持打开并显示原因，已填内容不丢。
3. **入口可解释**：当前账号没有创建权限时按钮保持可见但禁用，并在旁边说明原因。
4. **一条写入路径**：两个表单都生成完整 Kubernetes 清单后 POST 原生集合，读写的 API 组一致。

## 约束与边界

- 服务类型支持 ClusterIP、NodePort、Headless、ExternalName；Headless 等价于 `type: ClusterIP` + `clusterIP: None`；ExternalName 只需外部域名，不显示端口与选择器。
- 节点端口可留空由集群分配；填写时按默认范围 30000–32767 校验，集群配置了其他范围时以服务端拒绝为准。
- 选择器来自项目内 Deployment/StatefulSet/DaemonSet 的 app 标签，可手动填写；留空表示不设置选择器（Endpoints 手动维护）。
- 应用路由规则：host 可空（通配规则）；path 必须以 / 开头；pathType 为 Prefix/Exact；后端端口支持数字或命名端口；IngressClass 与 TLS 保密字典名为可选。
- 权限判断为一次 ks-apiserver IAM 权限检查（verb=create、resource、namespace，以请求用户求值；旧后端回退 `SelfSubjectAccessReview`）；检查本身失败时放行（fail-open），不因权限检查故障阻止写入。
- 写路径：Service 走 `/api/v1/namespaces/<ns>/services`，Ingress 走 `/apis/networking.k8s.io/v1/namespaces/<ns>/ingresses`。

## UI 交互设计

- 入口：列表页头部「创建」（`services:create` / `ingresses:create`），是 primaryAction；无权限时禁用并在按钮旁显示原因文本。
- 服务弹窗（`services-create:dialog`）：项目、名称、类型；类型为 NodePort 时出现节点端口；ClusterIP/NodePort/Headless 显示端口、目标端口、协议与选择器；ExternalName 显示外部域名。右上角「切换 YAML」保留高级清单编辑。
- 应用路由弹窗（`ingresses-create:dialog`）：项目、名称、IngressClass、TLS 保密字典；规则区一条一行，可「新增规则」「删除规则」，只剩一条时删除禁用。同样可切换 YAML。
- 提交中按钮 pending；成功关闭并刷新列表；失败保持打开并显示错误。

## 文案与校验

- 名称：必填，小写字母/数字/连字符，1–63 字符。
- 端口：必填，1–65535 的整数；目标端口为整数或命名端口（字母、≤15 字符）。
- 节点端口：可选，填写时为 30000–32767 的整数。
- 外部域名：ExternalName 时必填。
- 路由规则：每条都需要以 / 开头的路径、后端服务与端口；缺失时逐行提示并在规则区汇总。
- 同名冲突：提示「名称已存在，请输入其他名称。」；权限不足：由列表页按钮旁的说明文本预先告知。

| key | 中文 | 英文 |
| --- | --- | --- |
| `networkCreate.serviceHint` | 服务把流量转给带有指定 app 标签的容器组；类型决定对外暴露方式。 | The service forwards traffic to the pods carrying the selected app label; its type decides how it is reachable. |
| `networkCreate.nodePort` | 节点端口（可选） | Node port (optional) |
| `networkCreate.selector` | 选择器（app 标签） | Selector (app label) |
| `networkCreate.rules` | 路由规则 | Routing rules |
| `networkCreate.ruleAdd` | 新增规则 | Add rule |
| `networkCreate.noPermission` | 当前账号在该项目没有创建{resource}的权限。 | This account cannot create {resource} in this project. |

## 边界情况

- 项目内没有带 app 标签的工作负载：选择器下拉只有「手动填写」，不阻塞创建。
- 同名对象已存在：服务端返回 409，弹窗保留输入并显示「名称已存在」。
- 没有创建权限：列表页按钮禁用并有说明；仍可通过 API 直接创建（UI 不掩盖服务端能力）。
- 多集群/非 host 集群：权限检查请求的是 BFF 直连的集群，其他集群的权限以该集群为准（见 design 已知坑）。
- YAML 模式：解析失败或缺少名称/命名空间时不能提交，错误显示在弹窗内。
- 路由同域名多行：合并为一条规则；删除全部规则不被允许（至少一条）。

## 明确不做

- 不做服务类型的 LoadBalancer 与外部流量策略表单；需要时走 YAML。
- 不做多端口列表表单（保留 YAML 模式）。
- 不做 EndpointSlice/Endpoints 手工维护界面。
- 不做证书申请与签发，只接受已有 TLS 保密字典名。
- 不给服务/应用路由详情页增加创建后编辑表单（已有编辑 YAML/端口/规则入口）。
- 不改动 Job/CronJob 与工作负载创建。

## 假设

- 操作者在目标项目有创建 Service/Ingress 的权限；权限检查接口可用时按钮状态与服务端判断一致。
- 集群的 NodePort 范围保持默认，若已改配置则以服务端拒绝消息为准。
- 列表页的「创建」是页面唯一主动作，不与其他批量动作混排。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01**：系统必须在服务列表提供创建服务表单（类型、端口、NodePort 条件字段、选择器预填/手填），在应用路由列表提供创建路由表单（多规则增删），两者提交到原生集合，并在无权限时禁用入口且说明原因。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01**：回读的 Service/Ingress 字段与表单输入一致；同名冲突时弹窗不关闭且错误可见；无权限时创建按钮禁用并在旁边说明。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01`
