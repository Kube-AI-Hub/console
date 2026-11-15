# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03 网关设置 · 集群侧项目网关列表、行编辑/删除与无权限说明

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `gateway`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gateways/project`
- **需求**: `prd/kube-frontend/project-settings/gateway.md`

## 产品功能

集群网关页的项目页签列出项目网关的访问方式/IP/NodePort/副本数/追踪，行操作复用项目页的编辑弹窗与删除确认；无 update 权限时行编辑入口隐藏并说明。

### 关联需求

- `prd/kube-frontend/project-settings/gateway.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/gateway.md`](../../../../prd/kube-frontend/project-settings/gateway.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-GATEWAY-03** — 已知集群存在至少一个项目网关，当打开集群网关设置并切到项目页签，则列表显示名称、所属项目、访问方式、IP、NodePort、副本数与追踪，数值来自 Gateway spec 与该项目 Service 的同一次读取；行操作「编辑/删除」打开与项目网关页相同的编辑弹窗与删除确认，保存或删除后列表刷新显示回读结果；集群没有项目网关时显示「该集群还没有项目网关」而不是空白表格；当身份对某项目网关没有 update 权限时，该行编辑入口隐藏且页面说明原因，该画面与空结果、读取失败互不顶替。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/gateway.md`](../../../../design/kube-frontend/project-settings/gateway.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/gateway.md`](../../../../prd/kube-frontend/project-settings/gateway.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 在集群侧盘点并直接处理项目网关 (Priority: P2)

作为 **集群管理员**，我希望 **在网关设置的项目页签看到所有项目网关的访问方式、IP、NodePort、副本数与追踪，并直接编辑或删除**，以便 **不用逐个进入项目也能发现和修正入口配置**。

**Independent Test**：打开集群网关设置的项目页签，核对列与接口对象一致；对一行执行编辑/删除，回读生效；没有项目网关时显示说明；无 update 权限时该行编辑入口隐藏并说明。

## 前置与配置

- 已登录，host 集群，admin；用唯一前缀的临时命名空间创建项目网关（用例结束删除）
- 网关 Service 已创建并分配 NodePort

## 测试步骤

1. 用 API 创建临时项目网关并等待 Service
2. 打开 /clusters/host/gateways/project，等 cluster-gateways:surface 离开 loading
3. 核对表头与目标行的访问方式/IP/NodePort/副本数/追踪单元格
4. 打开该行操作菜单，点「编辑」，改副本数为 3 并保存，回读列表与接口
5. 拦截 SSAR 返回 allowed=false，刷新页面，核对行编辑入口隐藏且出现无权限说明；同时核对项目网关页编辑入口隐藏并说明
6. 移除拦截，回到列表，用行操作「删除」+ 输入名称确认，核对对象删除
7. 若列表已无项目网关，核对空态文案；清理命名空间

## 期望结果

- 项目页签表头含 名称/所属项目/访问方式/IP/NodePort/副本数/追踪；目标行单元格与 Service/Gateway 一致
- 行编辑打开与项目页相同的弹窗；保存后列表副本数变为 3 且接口回读一致
- SSAR 拒绝时行编辑入口隐藏，页面显示无权限说明；列表仍显示对象（不变成空态）
- 行删除后对象消失；无项目网关时显示「该集群还没有项目网关」

## 失败排查

- 行操作菜单里没有编辑：检查 SSAR 是否被误判为拒绝（fail-open 只对错误生效，明确 false 才隐藏）
- IP 为空：NodePort 网关没有 LoadBalancer ingress，属正常，显示 -
- 列表与接口不一致：确认列表 join 的是项目 Service 的端口而不是 Gateway status

## 产品改版后如何更新自动化

- 句柄：cluster-gateways:surface、:tab:project、[data-ai-row]、:cell:{type|ip|node-ports|replicas|tracing}、:edit、:delete、:project-edit-denied；删除确认 cluster-gateways:project:delete-input/delete-confirm
