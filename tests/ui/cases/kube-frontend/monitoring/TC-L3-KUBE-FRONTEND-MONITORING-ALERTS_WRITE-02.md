# TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-02 告警策略 · SSAR 写权限门控（拒绝隐藏、允许显示、检查失败放行）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `monitoring` `alerts-write`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/alertingrules`
- **需求**: `prd/kube-frontend/monitoring/alerts-write.md`

## 产品功能

写入口与 SelfSubjectAccessReview 结论一致：无权限时不显示创建/编辑/删除/启停并说明原因；有权限时显示且现有写用例仍通过；权限检查本身失败时放行（fail-open）。

### 关联需求

- `prd/kube-frontend/monitoring/alerts-write.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/monitoring/alerts-write.md`](../../../../prd/kube-frontend/monitoring/alerts-write.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-02** — 已知当前身份对 `alerting.kubesphere.io` 的 `rulegroups`（项目级）无 create/update/delete 权限，当打开告警策略列表与某条项目策略详情，则创建入口不出现并在列表上说明原因、行菜单只有「详情」、详情页没有编辑/删除/启停；当身份被允许，则上述入口出现且写路径与 AC-L3-KUBE-FRONTEND-MONITORING-ALERTS_WRITE-01 一致；当权限检查请求本身失败（非 2xx），则按「允许」处理（fail-open），不因检查故障隐藏本来可用的操作；启停按策略所属作用域分别检查 `rulegroups` / `clusterrulegroups` / `globalrulegroups` 的 update 权限。

### 关联设计

- 技术方案 [`design/kube-frontend/monitoring/alerts-write.md`](../../../../design/kube-frontend/monitoring/alerts-write.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/monitoring/alerts-write.md`](../../../../prd/kube-frontend/monitoring/alerts-write.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 没有写权限时不要看到点了就失败的操作 (Priority: P2)

作为 **只读的项目成员**，我希望 **没有创建/编辑/删除权限时页面不显示这些入口，并说明原因**，以便 **不会填完一个表单才被 403 拒绝；同时权限检查本身失败时不要误伤我本来就有的权限**。

**Independent Test**：拦截 `SelfSubjectAccessReview` 返回 `allowed: false` → 列表无创建按钮且有说明、行菜单只有详情、详情无编辑/删除/启停；放行后入口出现；检查返回 500 时入口仍在（fail-open）。

## 前置与配置

- 已登录
- 用唯一前缀测试对象创建一条项目级规则组，结束后删除

## 测试步骤

1. 用 API 以 tc-e2e- 前缀创建 1 条规则的规则组
2. 拦截 selfsubjectaccessreviews 返回 allowed=false，打开策略列表并打开行菜单
3. 打开该策略详情，核对操作按钮
4. 解除拦截，重载列表与详情，核对操作入口出现
5. 让 selfsubjectaccessreviews 返回 500，重载列表，核对创建入口仍在（fail-open）
6. finally 删除测试对象

## 期望结果

- allowed=false：列表出现无创建权限说明且没有创建按钮；行菜单只有「详情」；详情没有编辑/删除/启停
- 允许时：创建按钮、行菜单编辑/删除/启停、详情编辑/删除/启停均出现
- 检查失败（500）时创建入口仍出现，不因权限检查故障禁用允许的操作
- 测试对象最终被删除，回读 404

## 失败排查

- 拦截没生效：确认 route 匹配 **/selfsubjectaccessreviews，且请求是 POST
- 详情操作仍在：确认 canEdit/canDelete/canToggle 组合了 permissions
- 500 后入口消失：确认 hook 失败时返回 ALLOW_ALL，而不是 false

## 产品改版后如何更新自动化

- 权限资源或动词变化时改 pages/monitoring/queries 与 permissions.ts
