# 网关设置（L3）

[子模块需求](./_index.md)

## 概述

项目网关的增删、编辑与状态：没有网关时给出创建入口，有网关时显示名称、访问方式、访问地址、NodePort、副本数、链路追踪与控制器消息，并可编辑访问方式/副本数/追踪/注解/配置与固定 NodePort。集群侧另有项目网关列表，按同一编辑弹窗与删除确认直接处理。

## 用户故事

### US1 - 让项目的路由有对外入口 (Priority: P1)

作为 **项目管理员**，我希望 **在没有网关时一键创建，并看到它是否部署成功**，以便 **知道应用路由能不能被访问**。

**Independent Test**：打开网关设置页，创建网关后页面切到信息态并能看到状态徽标。

### US2 - 改网关的访问方式与容量 (Priority: P1)

作为 **项目管理员**，我希望 **修改网关的访问方式（NodePort/LoadBalancer）、副本数、链路追踪与注解**，以便 **按项目的访问与容量需求调整入口，而不是删掉网关重建**。

**Independent Test**：在网关设置页点「编辑设置」，修改访问方式、副本数与追踪并保存；页面与接口回读显示新值；输入负数副本数或非法 NodePort 时保存被阻止并显示错误。

### US3 - 在集群侧盘点并直接处理项目网关 (Priority: P2)

作为 **集群管理员**，我希望 **在网关设置的项目页签看到所有项目网关的访问方式、IP、NodePort、副本数与追踪，并直接编辑或删除**，以便 **不用逐个进入项目也能发现和修正入口配置**。

**Independent Test**：打开集群网关设置的项目页签，核对列与接口对象一致；对一行执行编辑/删除，回读生效；没有项目网关时显示说明；无 update 权限时该行编辑入口隐藏并说明。

## 验收场景

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-04** — 已知集群存在集群网关，当打开任一项目的网关设置页，则页面顶部显示「集群网关」卡片（名称、访问方式、访问地址）与「查看详情」链接，链接指向该集群的网关详情页；集群没有网关时该卡片不渲染。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01** — 已知项目没有网关，当打开网关设置页则显示空态与创建入口；点创建后页面切换到信息态并显示网关名称与状态；删除后回到空态。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02** — 已知项目已有网关，当在网关设置页点「编辑设置」，则弹窗显示接口当前 spec 的访问方式、副本数、链路追踪、服务注解（仅 LoadBalancer）与配置选项；修改访问方式、副本数、追踪开关与注解并保存后，Gateway 接口回读的 `spec.service.type`、`spec.deployment.replicas`、`spec.deployment.annotations['servicemesh.kubesphere.io/enabled']`、`spec.service.annotations` 与所填值一致，页面信息区显示新值；当访问方式为空、副本数为负数或非整数、NodePort 不是 30000–32767 的整数或两个端口重复时，保存被本地阻止并显示对应错误，且不发起写请求。
- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03** — 已知集群存在至少一个项目网关，当打开集群网关设置并切到项目页签，则列表显示名称、所属项目、访问方式、IP、NodePort、副本数与追踪，数值来自 Gateway spec 与该项目 Service 的同一次读取；行操作「编辑/删除」打开与项目网关页相同的编辑弹窗与删除确认，保存或删除后列表刷新显示回读结果；集群没有项目网关时显示「该集群还没有项目网关」而不是空白表格；当身份对某项目网关没有 update 权限时，该行编辑入口隐藏且页面说明原因，该画面与空结果、读取失败互不顶替。

## 设计目标

1. 无网关时给出可执行的下一步，而不是空表格。
2. 状态以控制器上报的 `Deployed` 条件为准。
3. 编辑只写 Gateway spec 与 Service 的 NodePort；拒绝非法值在本地完成，保存后以接口回读为事实。

## 约束与边界

- 读 `gateway.kubesphere.io/v1alpha1` 的 Gateways（项目命名空间）。
- 创建使用 NodePort 类型：不依赖云负载均衡，任何集群都可用。
- 编辑写 Gateway CR 的 `spec.service.type`、`spec.deployment.replicas`、`spec.deployment.annotations`、`spec.service.annotations`、`spec.controller.config`；NodePort 写项目 Service 的端口（Gateway CRD 无该字段）。
- NodePort 采用 Kubernetes 默认范围 30000–32767；地址与端口来自网关 Service，不读 Gateway 的 status。

## UI 交互设计

项目页两态：空态（说明 + 创建按钮）与信息态（名称/访问方式/地址/NodePort/副本数/追踪/创建者/控制器消息 + 状态徽标 + 编辑/删除）；编辑为共享弹窗（访问方式、副本数、追踪、NodePort、服务注解、配置选项），保存中禁用关闭。集群侧项目页签为表格（名称/所属项目/访问方式/IP/NodePort/副本数/追踪/状态 + 行操作），行操作复用同一弹窗与删除确认。

## 文案与校验

- 状态：已就绪 / 部署中。
- 字段：网关名称、访问方式、访问地址、NodePort、副本数、链路追踪、创建者、控制器消息。
- 校验（本地阻止保存）：访问方式必选；副本数为不小于 0 的整数；NodePort 为 30000–32767 的整数且互不重复；留空表示保留已分配/自动分配的端口。
- 保存失败（含并发冲突重试后）：弹窗内显示可读错误并保留输入。

## 边界情况

- 未就绪时每 5 秒自动刷新，避免用户手动刷新。
- 访问方式与地址由控制器填充，创建后短时间可能为空；编辑保存后服务类型切换有短暂延迟，页面以接口回读为准。
- 网关 Service 尚未创建时 NodePort 输入显示「端口尚未分配」，不发起端口写入。
- 无 update 权限：不显示编辑入口并说明；无 delete 权限：不显示删除入口。
- 集群侧项目页签：无项目网关显示说明；某行权限不足只隐藏该行操作，不把列表显示成空。

## 明确不做

- 网关的日志与监控。
- 修改网关 Service 的容器端口/协议与服务类型以外的网络参数（属基础设施配置）。（旧判断「修改网关类型、端口与副本数不做」已由本轮任务推翻：旧 console 的编辑弹窗本来就写访问方式/追踪/注解/配置，副本数可由详情页扩缩；本轮按任务补齐编辑设置，并以探测到的 CRD 字段为准。）
- 集群网关（宿主网关）的创建/编辑/删除：仍由集群管理员安装流程与网关详情页负责，本单元只做项目网关的行编辑/删除；批量删除与旧版网关升级入口本轮不做（当前集群没有可升级对象）。

## 假设

- 网关由平台的 Gateway 控制器部署（Helm release）。若控制器未安装，网关会长期停在「部署中」。

## 验收用例

- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-04`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02`
- `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03`

## 功能需求

- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01** — 两态切换与创建/删除。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02** — 状态取自 `Deployed` 条件。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03** — 编辑 Gateway spec 与 Service NodePort，保存后回读；非法值本地拒绝。
- **FR-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-04** — 集群侧项目网关列表含访问方式/IP/NodePort/副本数/追踪与行编辑/删除，空态与无权限分开。

## 成功标准

- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-01** — 创建后 Gateway 对象存在，删除后不存在。
- **SC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-02** — 编辑保存后接口回读五项字段与所填一致；非法值 0 写请求；集群侧列表行数与接口项目网关数一致。
