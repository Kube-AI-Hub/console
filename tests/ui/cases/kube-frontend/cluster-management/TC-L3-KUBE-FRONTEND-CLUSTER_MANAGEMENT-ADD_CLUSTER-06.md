# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06 代理接入清单 · cluster-agent 资源规格

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `add-cluster`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/add-cluster.md`

## 产品功能

代理接入时控制台生成的 agent.yaml 里，cluster-agent 的内存上限是 2Gi、请求是 100Mi，用二进制单位；这个值由平台决定，读者不需要也不能在界面上改。

### 关联需求

- `prd/kube-frontend/cluster-management/add-cluster.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-06** — 已知用代理连接创建了集群且它尚未就绪，当打开该集群概览页并展开生成的 `agent.yaml`，则清单中 `cluster-agent` Deployment 的容器 `agent` 必须声明 `resources.limits.memory` 为 `2Gi`、`resources.requests.memory` 为 `100Mi`（CPU 为 limit `1` / request `100m`），使用二进制单位（`Gi`/`Mi`）而不是十进制（`G`/`M`）；该清单由 `GET /kapis/cluster.kubesphere.io/v1alpha1/clusters/<name>/agent/deployment` 生成，不经由前端拼装，因此同一平台上的任何成员集群看到的资源规格一致。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/add-cluster.md`](../../../../design/kube-frontend/cluster-management/add-cluster.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 把已有集群接入平台 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表里粘贴成员集群的 kubeconfig 完成接入**，以便 **在不离开控制台的情况下把新集群纳入管理**。

**Independent Test**：在集群列表点「添加集群」，填入名称与 kubeconfig 并确认；列表中应出现该集群，且集群对象中存在 base64 编码的 kubeconfig。

## 前置与配置

- 已登录平台管理，账号有 clusters:create 权限
- 平台已部署 tower（多集群代理组件）

## 测试步骤

1. 用代理连接创建一个集群，不部署 agent
2. 打开该集群概览页，等待「等待集群加入」面板
3. 读取面板中 agent.yaml 编辑器里的清单内容
4. 直接请求 GET /kapis/cluster.kubesphere.io/v1alpha1/clusters/{name}/agent/deployment，对照两者

## 期望结果

- 清单中 Deployment/cluster-agent 位于 namespace kubesphere-system
- 容器 agent 的 resources.limits.memory 为 2Gi，resources.requests.memory 为 100Mi
- resources.limits.cpu 为 1，resources.requests.cpu 为 100m
- 单位是 Gi/Mi；清单中不出现 2G、512M 这类十进制写法
- 界面展示的清单与接口返回逐字一致（前端不重写资源字段）

## 失败排查

- 仍看到 200M 或 512M：apiserver 镜像未更新，清单由 kube-server 生成而非前端
- 看到 2G（十进制）：MustParse 的单位写错，2G 比 2Gi 少约 147MB
- 概览页无清单：平台未部署 tower，接口会返回 404 并提示 tower 无对外地址

## 产品改版后如何更新自动化

- 资源规格变更时同步 prd 的 AC-06、design 的 CON-…-01 与 TestGeranteAgentDeployment 的 golden 文本
