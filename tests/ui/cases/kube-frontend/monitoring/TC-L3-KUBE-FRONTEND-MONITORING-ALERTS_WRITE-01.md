# TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01 告警策略 · 创建（描述与规则）、编辑描述与级别、删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `alerts-write`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/alerts-write.md`

## 产品功能

项目级自定义策略可在页面上创建（名称 + 描述 + 一条规则）、编辑描述与规则级别、删除；API 回读逐字段验证，内置与集群级策略不提供写入口。

### 关联需求

- `prd/kube-frontend/monitoring/alerts-write.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/alerts-write.md`](../../../../prd/kube-frontend/monitoring/alerts-write.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01** — 已知选定了某个项目，当在告警策略页创建一条策略（策略名 + 描述 + 一条规则：告警名称、表达式、持续时间、严重度、说明与消息）并提交，则该项目命名空间下出现对应的 `rulegroups` 对象，其 `metadata.annotations['kubesphere.io/description']` 等于填写的描述、`spec.rules` 与填写内容逐条一致（告警名、表达式、持续时间、严重度、`annotations.summary`、`annotations.message`），且列表中出现该策略；当通过行操作「编辑」修改描述与规则级别并提交，则回读对象的描述与规则级别均已更新且其余规则未被删除；当通过行操作「删除」并确认，则该对象不再存在（回读 404、列表不再包含）；内置与集群级策略不提供编辑/删除入口。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/alerts-write.md`](../../../../design/kube-frontend/monitoring/alerts-write.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/alerts-write.md`](../../../../prd/kube-frontend/monitoring/alerts-write.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 自己建一条策略并改它 (Priority: P1)

作为 **项目管理员**，我希望 **在页面上创建、修改、删除本项目自己的告警策略**，以便 **不必写 YAML 就能给项目加一条阈值告警，并在阈值变化时调整它**。

**Independent Test**：以 `tc-e2e-` 前缀创建一条带 1 条规则和描述的策略 → 回读对象核对描述注解与 `spec.rules` → 编辑描述与级别 → 回读确认 → 删除 → 回读 404。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 用例使用 tc-e2e- 前缀的策略名，finally 中按名删除

## 测试步骤

1. 打开告警策略页（项目已选定），点「创建策略」
2. 填写策略名、描述与一条规则（告警名、表达式、持续时间、说明、消息），提交
3. 用 API 回读该 rulegroup，核对描述注解与 spec.rules
4. 搜索该策略使其出现在列表；通过行操作「编辑」修改描述与规则级别并提交，再次回读
5. 通过行操作「删除」并确认，再次回读

## 期望结果

- 创建后对象存在，描述注解等于填写值，spec.rules 的告警名、表达式、持续时间、级别、说明、消息与填写一致
- 列表出现该策略行
- 编辑后描述与级别已更新，规则仍在
- 删除后对象不存在（读取返回 404）

## 失败排查

- 创建按钮不出现：没有选定项目（全部项目视图下不可写）
- 描述回读为空：是否写到了 metadata.annotations 的 kubesphere.io/description
- 编辑后级别未变：Select 选项是否提交，PUT 是否携带 resourceVersion
- 删除后仍能读到：确认删除的是项目级规则组

## 产品改版后如何更新自动化

- 对话框字段或 data-ai-id 变化时同步 pages/monitoring.py 与本用例
