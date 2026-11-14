# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01 创建服务与应用路由 · NodePort、选择器、多规则与同名报错

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `create-service-ingress`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/services`
- **需求**: `prd/kube-frontend/app-workloads/resource-create.md`

## 产品功能

列表页的「创建」打开服务/应用路由的定制表单：服务可选 NodePort 并在该类型下显示节点端口字段、选择器可从工作负载 app 标签选取；应用路由可增删规则，同一域名的多条路径合并为一条规则。同名再建时弹窗保持打开并显示冲突。

### 关联需求

- `prd/kube-frontend/app-workloads/resource-create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/resource-create.md`](../../../../prd/kube-frontend/app-workloads/resource-create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-CREATE_SERVICE_INGRESS-01** — 已知一个部署带着唯一的 app 标签，当在服务列表点「创建」并选择 NodePort 类型，则节点端口字段出现；填名称、8080→80、选择器选该标签并提交后，回读 `spec.type=NodePort`、`spec.selector={app: 标签}`、`ports[0]` 为 8080→80 且 `nodePort` 由集群分配；当用同一名称再次提交，则弹窗不关闭且错误提示包含「已存在」；当在应用路由列表创建一条域名规则、新增第二条规则后删除再新增并按同一域名填写路径 /static，则回读 `rules` 只有一条该域名的规则、两条路径分别指向数字端口与命名端口。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/resource-create.md`](../../../../design/kube-frontend/app-workloads/resource-create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/resource-create.md`](../../../../prd/kube-frontend/app-workloads/resource-create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 建一个能被节点访问的服务 (Priority: P1)

作为 **项目运维**，我希望 **在服务列表直接创建 NodePort 服务，端口指到容器的 8080、选择器从已有工作负载的 app 标签里选**，以便 **不必先写 YAML 就能把工作负载暴露到节点端口**。

**Independent Test**：创建一个带唯一 app 标签的部署，再创建 NodePort 服务（8080→80，选择器选该标签），回读 `spec.type`、`spec.selector`、`spec.ports` 与输入一致，节点端口由集群分配。

### US2 - 一条域名下配多条路径 (Priority: P1)

作为 **项目运维**，我希望 **创建一个应用路由，并在同一域名下增删多条路径、分别指向服务端口**，以便 **不必为每个路径单独建一个路由对象**。

**Independent Test**：创建路由时填两条同一域名的路径（/api→8080、/static→命名端口），回读 `spec.rules` 只有一条 host 规则、两条 `http.paths`。

## 前置与配置

- 由用例的 fixture 创建一个 tc-e2e- 前缀的部署（带唯一 app 标签）作为选择器来源，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间，账号有创建服务与应用路由的权限

## 测试步骤

1. 打开服务列表，点「创建」，填名称、选 NodePort、端口 8080→80，选择器选 fixture 的 app 标签，提交
2. 回读 Service 的 spec
3. 再次创建同名服务并提交
4. 打开应用路由列表，点「创建」，填名称与第一条规则（host、/api、后端服务:8080）
5. 新增第二条规则后删除，再新增并按同一 host、路径 /static、命名端口填写，提交
6. 回读 Ingress 的 rules

## 期望结果

- NodePort 类型下节点端口字段可见；提交后 spec.type 为 NodePort，ports[0] 为 8080→80 且 nodePort 由集群分配
- {'spec.selector 为 {app': 'fixture 的标签}'}
- 同名再建时弹窗不关闭，错误提示包含「已存在」
- 规则增删可用；回读 rules 只有一条 host 规则，两条 path 为 /api 与 /static，端口分别为数字 8080 与命名端口
- 成功后弹窗关闭，列表出现新对象

## 失败排查

- 创建返回 405 时检查是否误写 kapis，创建应 POST 原生集合（/api/v1 或 /apis/networking.k8s.io/v1）
- 选择器下拉没有 fixture 标签时先确认部署已创建且列表查询已返回
- NodePort 分配失败时看集群 nodePort 范围配置

## 产品改版后如何更新自动化

- 选择器见 pages/app_workloads.py 的 service_create_field / ingress_rule_field / choose_select
