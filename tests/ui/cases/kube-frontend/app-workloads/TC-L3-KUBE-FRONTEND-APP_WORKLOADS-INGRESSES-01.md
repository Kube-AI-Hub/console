# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-INGRESSES-01 应用路由 · 编辑路由规则

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-INGRESSES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `ingresses`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/ingresses`
- **需求**: `prd/kube-frontend/app-workloads/_index.md`

## 产品功能

行操作「编辑路由规则」可改域名/路径/后端，提交后 spec.rules 更新且结构正确。

### 关联需求

- `prd/kube-frontend/app-workloads/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-INGRESSES-01** — 已知一条应用路由有 `host=old.example.com` 且后端为 `kubernetes:443`，当行操作「编辑路由规则」把域名改为 `new.example.com`，则 `spec.rules[0].host` 更新且后端仍为 `service.port.number=443`。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/_index.md`](../../../../design/kube-frontend/app-workloads/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/_index.md`](../../../../prd/kube-frontend/app-workloads/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪些负载不健康 (Priority: P1)

作为 **项目运维**，我希望 **在列表上直接看到每个负载的状态与就绪副本**，以便 **不必逐个点开就知道哪里出了问题**。

**Independent Test**：打开部署列表，核对状态列与就绪列，任取一行与 `kubectl get deploy` 的结果比对。

## 前置与配置

- 由夹具创建一条带 host=old.example.com、后端 kubernetes:443 的 tc-e2e- 路由，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开路由列表并打开该行操作
2. 点「编辑路由规则」，把域名改为 new.example.com
3. 确认后读取 spec.rules
4. 删除该路由

## 期望结果

- 行操作包含「编辑路由规则」
- spec.rules[0].host 为 new.example.com
- 后端仍是 service.port.number=443（未被改写）

## 失败排查

- 后端被清空说明提交时丢了 serviceName/servicePort
- 422 说明 pathType 或 backend 结构写错

## 产品改版后如何更新自动化

- 规则结构变化时改 api-client 的 ingressRulesOf / setIngressRules
