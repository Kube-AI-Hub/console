# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICE_PODS-01 服务详情 · 关联容器组与端口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICE_PODS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `service-pods`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/services`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

服务详情同时显示端口表与关联容器组；容器组按服务的扁平选择器（spec.selector）匹配。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-SERVICE_PODS-01** — 已知一个服务选中了某些容器组，当打开其详情，则同时显示「端口」与「关联容器组」两个区块，且容器组行数等于该服务 `spec.selector` 匹配到的 Pod 数。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 由夹具创建一个部署（2 副本）与一个选择它的服务，用例结束无条件删除两者
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开该服务详情
2. 在「概览」页签读取端口表
3. 点「关联容器组」页签，读取容器组表
4. 用 API 按服务选择器统计 Pod

## 期望结果

- 服务详情出现「关联容器组」区块
- 行数等于服务选择器匹配到的 Pod 数
- 同时存在「端口」区块

## 失败排查

- 区块不出现：详情页改用页签后，容器组表只在「关联容器组」页签内渲染，需先点页签
- 点开页签仍为空说明按 workload 的 matchLabels 形状读了服务选择器（服务是扁平 map）
- 行数为 0 而 API 有匹配，多为选择器解析错误

## 产品改版后如何更新自动化

- 选择器形状变化时改 api-client 的 pods()
