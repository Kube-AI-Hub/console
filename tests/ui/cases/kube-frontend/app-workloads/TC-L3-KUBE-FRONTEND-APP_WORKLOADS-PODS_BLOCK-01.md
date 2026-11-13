# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PODS_BLOCK-01 负载详情 · 关联容器组

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-PODS_BLOCK-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `pods-block`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/deployments`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

部署详情列出其麾下容器组（名称、状态、节点、重启次数、创建时间），数量与按选择器查到的 Pod 数一致。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-PODS_BLOCK-01** — 已知一个部署有就绪的容器组，当打开其详情，则显示「关联容器组」表（容器组名称、状态、所在节点、重启次数、创建时间），行数与该部署选择器匹配到的 Pod 数一致。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 由夹具创建一个 2 副本的 tc-e2e- 部署并等待其 Pod 就绪，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该部署详情
2. 读取关联容器组表
3. 用 API 按选择器统计 Pod 数

## 期望结果

- 表头为 容器组名称、状态、所在节点、重启次数、创建时间
- 行数与 API 统计一致
- 每行状态非空

## 失败排查

- 区块不出现说明选择器为空或 Pod 尚未创建
- 行数偏多说明未按 ownerReferences 过滤（当前按选择器统计，同名标签会重合）

## 产品改版后如何更新自动化

- 区块字段变化时改 api-client 的 toWorkloadPod
