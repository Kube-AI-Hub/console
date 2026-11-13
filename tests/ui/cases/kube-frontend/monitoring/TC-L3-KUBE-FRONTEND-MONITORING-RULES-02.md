# TC-L3-KUBE-FRONTEND-MONITORING-RULES-02 告警策略 · 启用停用只改标签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

点「停用」只把 alerting.kubesphere.io/enable 标签改成 false，规则体不变；再点「启用」还原。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-02** — 已知某规则组处于启用状态，当对它点「停用」，则其 `alerting.kubesphere.io/enable` 标签变为 `false`、状态徽章变为「已停用」，且 `spec.rules` 未被改动；再点「启用」后标签与徽章还原。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 只启用或停用，不改规则体 (Priority: P2)

作为 **集群管理员**，我希望 **只切换策略的启用状态**，以便 **不会因为一次开关操作覆盖掉别人正在编辑的规则内容**。

**Independent Test**：对一条策略点「停用」，然后读取该对象，核对只有 `alerting.kubesphere.io/enable` 标签变化、`spec.rules` 内容不变；再点「启用」还原。

## 前置与配置

- 集群里有可写的规则组（globalrulegroups）
- 用例开始前记录该组原标签与 spec，结束时无条件还原

## 测试步骤

1. 用 API 读取一个规则组，记录原 enable 标签与 spec.rules 的长度与首条规则名
2. 打开告警策略页，搜索该组，打开行菜单点「停用」
3. 用 API 回读标签与 spec
4. 再点「启用」，再次回读

## 期望结果

- 停用后标签为 false，spec.rules 长度与首条规则名不变
- 启用后标签还原为原值
- 列表状态徽章随之变化

## 失败排查

- 标签没变：确认写的是 label 而不是 annotation
- spec 被改：说明用了 PUT 整对象而不是 merge patch
- 找不到「停用」菜单项：确认该行当前是启用状态（两个互斥菜单项）

## 产品改版后如何更新自动化

- 开关实现变化时改 api-client 的 alerting.ts
