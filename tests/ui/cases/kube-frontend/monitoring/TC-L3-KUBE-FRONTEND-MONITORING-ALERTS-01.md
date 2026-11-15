# TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01 告警消息 · 模块缺失时为空态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `alerts`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alerts`
- **需求**: `prd/kube-frontend/monitoring/alerts.md`

## 产品功能

['告', '警', '消', '息', '页', '在', '没', '有', '数', '据', '时', '显', '示', '空', '态', '，', '不', '显', '示', '错', '误', '面', '板', '。']

### 关联需求

- `prd/kube-frontend/monitoring/alerts.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/alerts.md`](../../../../prd/kube-frontend/monitoring/alerts.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-ALERTS-01** — 已知项目内没有活动告警（模块未安装时也是同一读路径返回 0 条），当打开告警消息页，则页面状态为 `empty` 并显示空态标题与说明，不出现错误面板。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/alerts.md`](../../../../design/kube-frontend/monitoring/alerts.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/alerts.md`](../../../../prd/kube-frontend/monitoring/alerts.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清当前告警与级别 (Priority: P1)

作为 **值班运维**，我希望 **在列表上直接看到状态、级别与触发时间**，以便 **判断先处理哪一条**。

**Independent Test**：打开告警消息页，核对列与状态徽章。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 先通过 API 确认该页没有数据（模块未安装时接口返回空响应体）

## 测试步骤

1. 打开该页
2. 读取页面状态与空态文案
3. 统计表头数量

## 期望结果

- data-ai-state 为 empty
- 显示空态标题与说明
- thead 数量为 0

## 失败排查

- 出现错误面板说明空响应体没有被当成空列表
- 状态为 error 时看 kapis 前缀是否正确

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
