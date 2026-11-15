# TC-L3-KUBE-FRONTEND-MONITORING-RULES-07 告警策略 · 批量启用与停用

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

告警策略列表支持多选后批量启用/停用，逐条写 enable 标签并回读一致；不可写的行不给复选框；部分失败如实报告。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-07** — 已知列表里有多条当前身份可写的策略，当勾选其中若干条并点批量「停用」，则逐条把 `alerting.kubesphere.io/enable` 置为 `false`、回读全部变为已停用，页面显示「已处理 N 条」；再批量「启用」后全部还原；没有 update 权限的行不出现复选框（选择即写入，不可写的行不能被选中）；部分失败时提示已处理条数与失败名单，且不回滚已成功的行。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US8 - 一次停用多条策略 (Priority: P2)

作为运维者，当一批策略需要同时停用（例如维护窗口），我可以在列表里多选后一次停用/启用，而不是逐条点行操作；结果要告诉我处理了几条、哪几条失败。

## 前置与配置

- 已登录；当前项目可创建 rulegroup（admin）

## 测试步骤

1. 通过 API 在当前项目创建两个唯一命名的 rulegroup
2. 打开告警策略列表，勾选两个策略行
3. 点批量「停用」，等请求完成；回读两个对象的 enable 标签
4. 再批量「启用」，回读标签；核对结果提示

## 期望结果

- 勾选后出现批量动作（alertingrules:bulk-enable / bulk-disable）
- 停用后两个对象 enable 标签均为 false，启用后均为 true
- 结果提示显示处理条数（alertingrules:bulk-result）
- 无 update 权限的行不出现复选框

## 失败排查

- 批量动作不出现：schema.actions 未声明或 selection 不是 multiple
- 只有第一行被改：批量处理里错用了单条 mutation

## 产品改版后如何更新自动化

- 句柄：alertingrules:surface / [data-ai-row] input[type=checkbox] / alertingrules:bulk-enable / alertingrules:bulk-disable / alertingrules:bulk-result
