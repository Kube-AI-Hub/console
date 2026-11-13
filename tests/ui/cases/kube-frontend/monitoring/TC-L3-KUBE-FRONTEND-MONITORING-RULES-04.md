# TC-L3-KUBE-FRONTEND-MONITORING-RULES-04 告警策略 · 创建、编辑与删除项目策略

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-RULES-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/rules.md`

## 产品功能

选定项目后可创建单规则的告警策略，编辑其表达式，删除该策略；内置与集群级策略不提供编辑/删除入口。

### 关联需求

- `prd/kube-frontend/monitoring/rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-RULES-04** — 已知选定了某个项目，当创建一条策略（策略名、告警名、表达式、持续时间、严重度、说明）并提交，则该项目命名空间下出现对应的 `rulegroups` 对象，其 `spec.rules` 与填写内容一致；当通过行操作编辑表达式并提交，则回读对象中表达式已更新；当删除该策略，则对象不再存在。内置或集群级规则组不提供编辑/删除入口。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/rules.md`](../../../../design/kube-frontend/monitoring/rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/rules.md`](../../../../prd/kube-frontend/monitoring/rules.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 自己建一条策略并改它 (Priority: P1)

作为 **项目管理员**，我希望 **在页面上创建、修改、删除本项目自己的告警策略**，以便 **不必写 YAML 就能为项目加一条阈值告警**。

**Independent Test**：创建一条策略 → 回读对象确认 `spec.rules` 的告警名与表达式 → 编辑表达式 → 回读确认 → 删除 → 回读 404。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 用例使用 tc-e2e- 前缀的策略名，finally 中删除

## 测试步骤

1. 打开告警策略页（项目已选定），点创建
2. 填写策略名、告警名、表达式、持续时间、严重度与说明，提交
3. 用 API 回读该 rulegroup，核对 spec.rules 的告警名与表达式
4. 通过行操作编辑表达式并提交，再次回读
5. 通过行操作删除，确认后再次回读

## 期望结果

- 创建后对象存在且 spec.rules 与填写一致
- 编辑后表达式已更新
- 删除后对象不存在（读取返回 404 或列表不再包含）
- 内置/集群级行只有 详情、启用/停用，没有 编辑/删除

## 失败排查

- 创建按钮不出现：没有选定项目（全部项目视图下不可写）
- 提交后 422：表达式或告警名为空
- 编辑后规则消失：写入应整体替换 spec.rules，但需保留编辑的那一条
- 删除后仍能读到：确认删除的是项目级规则组

## 产品改版后如何更新自动化

- 对话框字段变化时改 pages/monitoring.py 与本用例
