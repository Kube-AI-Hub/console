# TC-L3-KUBE-FRONTEND-MONITORING-RULES-02 告警策略 · 启用停用写入标签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

点「启用/停用」会取反 alerting.kubesphere.io/enable 标签，列表状态随之变化。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-02** — 已知告警策略列表有数据，当对一条策略点「启用/停用」，则其 `alerting.kubesphere.io/enable` 标签被取反，列表状态徽章随之变化。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清哪些策略启用、各有多少规则 (Priority: P1)

作为 **项目运维**，我希望 **在列表上看到启用状态与规则数**，以便 **确认监控覆盖是否如预期**。

**Independent Test**：打开告警策略页，核对列与启用徽章。

## 前置与配置

- 由夹具通过 IAM/告警接口创建一个 tc-e2e- 前缀的告警策略，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开告警策略页并定位该策略
2. 读取当前状态
3. 点「启用/停用」
4. 用 API 读取该策略的标签

## 期望结果

- 标签 alerting.kubesphere.io/enable 被取反
- 列表状态徽章与标签一致

## 失败排查

- 标签未变化时确认写的是 label 而不是 annotation
- 接口返回空体说明告警模块未安装，用例会自动跳过

## 产品改版后如何更新自动化

- 开关实现变化时改 api-client 的 alerting.ts
