# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-04 集群列表 · 更新成员集群 kubeconfig

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-list`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/cluster-list.md`

## 产品功能

直接连接的成员集群可「更新 kubeconfig」；提交不可用内容时显示服务端原因且对象不被改动；代理连接与主集群不提供该操作。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-list.md`](../../../../prd/kube-frontend/cluster-management/cluster-list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-04** — 已知列表里有一个非主集群且连接方式为直接连接，当通过行操作「更新 kubeconfig」提交一段不可用的 kubeconfig，则界面显示服务端给出的原因（而不是「Bad Request」之类通用文案），且集群对象的 `spec.connection.kubeconfig` 未被改动；代理连接的集群不提供该操作。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-list.md`](../../../../design/kube-frontend/cluster-management/cluster-list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-list.md`](../../../../prd/kube-frontend/cluster-management/cluster-list.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 换掉成员集群的 kubeconfig (Priority: P2)

作为 **平台管理员**，我希望 **在成员集群换了访问凭据后更新 kubeconfig**，以便 **不必删除再重新接入**。

**Independent Test**：对一个直接连接的临时集群点「更新 kubeconfig」，提交非法内容时界面给出服务端原因且对象未被改动。

## 前置与配置

- 已登录平台管理
- 用例先创建一个临时 direct 集群对象（tc-e2e- 前缀），finally 中删除

## 测试步骤

1. 用 API 创建一个临时 direct 集群（kubeconfig 为任意 base64，仅占位）
2. 打开列表，打开该集群行操作，核对存在「更新 kubeconfig」
3. 提交一段不包含 apiVersion/clusters/server 的内容，核对本地校验提示
4. 提交一段结构合法但不可连接的内容，核对出现服务端原因（含 invalid configuration 等字样）
5. 回读该集群对象，核对 spec.connection.kubeconfig 未变化
6. 核对代理连接或主集群行没有「更新 kubeconfig」

## 期望结果

- 本地先拦结构错误，不发请求
- 服务端错误原文可见，不是「Bad Request」
- 失败后对象未被改动
- 代理连接与主集群不提供该操作

## 失败排查

- 错误只显示 Bad Request：客户端把纯文本错误体丢掉了（见 DEC-...-08）
- 提交后对象被改：服务端应拒绝不可用配置

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_fleet.py 与 UpdateKubeconfigDialog.tsx
