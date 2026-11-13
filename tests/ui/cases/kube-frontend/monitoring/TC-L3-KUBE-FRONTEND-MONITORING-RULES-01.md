# TC-L3-KUBE-FRONTEND-MONITORING-RULES-01 告警策略 · 规则组列表与规则数一致

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

告警策略页列出集群的规则组，列含名称（副行作用域）、策略状态、规则数、类型、创建时间，规则数与接口 spec.rules 长度一致。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-01** — 已知集群提供规则组资源，当打开告警策略页，则列出全部规则组，列含名称（副行为作用域）、策略状态、规则数、类型、创建时间；每行规则数等于该组 `spec.rules` 长度；页面状态为 `ready`；分页总数等于各来源合并后的条数。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清哪些策略启用、各有多少规则 (Priority: P1)

作为 **项目运维**，我希望 **在列表上看到启用状态与规则数**，以便 **确认监控覆盖是否如预期**。

**Independent Test**：打开告警策略页，核对列与启用徽章。

## 前置与配置

- 已登录，且在 host 集群
- 集群的 alerting API 组提供 globalrulegroups 或 clusterrulegroups

## 测试步骤

1. 探测 /apis/alerting.kubesphere.io/v2beta1 的资源清单，确认是规则组模型
2. 用 API 读取 globalrulegroups 与 clusterrulegroups，记下条数与每个组的规则数
3. 打开告警策略页，等待 surface 就绪
4. 核对表头、行数、分页总数
5. 逐行核对规则数与接口一致

## 期望结果

- 页面状态为 ready，表头包含 名称、策略状态、规则数、类型、创建时间
- 分页显示的总数等于两个来源条数之和
- 每一行的规则数等于该组 spec.rules 长度

## 失败排查

- 页面为空但接口有数据：确认告警策略页走了规则组分支（探测 API 组是否返回 globalrulegroups）
- 规则数为 0 但接口有规则：确认读的是 spec.rules 而不是 spec.groups
- 总数不一致：检查是否漏掉 clusterrulegroups

## 产品改版后如何更新自动化

- 接口或列变化时改 pages/monitoring.py 与 api-client 的 alerting.ts
