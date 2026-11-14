# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01 服务与应用路由创建 · 表单与回读

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `network-create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/services`
- **需求**: `prd/kube-frontend/app-workloads/network-create.md`

## 产品功能

用表单创建服务与应用路由，回读端口、选择器及后端配置。

### 关联需求

- `prd/kube-frontend/app-workloads/network-create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/network-create.md`](../../../../prd/kube-frontend/app-workloads/network-create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-NETWORK_CREATE-01** — 服务和应用路由列表均提供创建入口；表单创建 Service 后回读服务类型、选择器及端口映射与输入一致；创建 Ingress 后回读域名、路径与后端一致。非法名称、路径、端口阻止提交；写入失败在弹窗内显示并保留输入。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/network-create.md`](../../../../design/kube-frontend/app-workloads/network-create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/network-create.md`](../../../../prd/kube-frontend/app-workloads/network-create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 为工作负载创建访问入口 (Priority: P1)

作为 **项目运维**，我希望 **创建服务和应用路由**，以便 **为已有负载配置稳定的访问入口**。

**Independent Test**：分别在服务和应用路由列表创建一次性对象，回读端口、选择器、域名、路径与后端。

## 前置与配置

- 已登录并有 default 项目的创建权限
- 对象使用 uuid 唯一命名，finally 清理

## 测试步骤

1. 打开服务创建，填写名称、选择器与端口并提交
2. 回读服务的端口和选择器
3. 创建指向该服务的应用路由并回读规则

## 期望结果

- Service 与 Ingress 在原生 API 中存在且字段与输入一致
- 成功后弹窗关闭，失败时不丢失输入

## 失败排查

- 创建返回 405 时检查是否误写 kapis，创建应该 POST 原生集合

## 产品改版后如何更新自动化

- 选择器见 pages/app_workloads.py
