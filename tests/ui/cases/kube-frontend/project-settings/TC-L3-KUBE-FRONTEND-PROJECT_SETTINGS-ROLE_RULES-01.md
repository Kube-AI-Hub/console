# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01 项目角色 · 详情列出权限规则

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `role-rules`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/roles`
- **需求**: `prd/kube-frontend/project-settings/role-rules.md`

## 产品功能

['对', '某', '角', '色', '点', '详', '情', '，', '弹', '窗', '列', '出', '其', '权', '限', '规', '则', '，', '行', '数', '等', '于', None, 'r', 'u', 'l', 'e', 's', None, '数', '量', '。']

### 关联需求

- `prd/kube-frontend/project-settings/role-rules.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/role-rules.md`](../../../../prd/kube-frontend/project-settings/role-rules.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLE_RULES-01** — 已知角色列表有数据，当对某角色点「详情」，则弹窗显示该角色的规则表，行数等于其 `rules` 数量。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/role-rules.md`](../../../../design/kube-frontend/project-settings/role-rules.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/role-rules.md`](../../../../prd/kube-frontend/project-settings/role-rules.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认一个角色到底能做什么 (Priority: P1)

作为 **项目管理员**，我希望 **看到角色的规则明细**，以便 **回答「他能改什么」**。

**Independent Test**：对任一角色点「详情」，核对规则行与 `kubectl get role <name> -o yaml` 的 `rules` 一致。

## 前置与配置

- 已登录，且在 host 集群的 default 项目空间
- 该项目内至少有一个带规则的角色

## 测试步骤

1. 打开项目角色页
2. 对第一行点「详情」
3. 读取弹窗内规则表
4. 用 API 核对该角色的 rules 数量

## 期望结果

- 弹窗出现并含规则表
- 规则表行数等于 API 返回的 rules 数量
- 表头为 API 组、资源、动作

## 失败排查

- 弹窗为空说明详情请求失败或 rules 为空
- 行数不符时看 toRoleRule 的数组拼接

## 产品改版后如何更新自动化

- 规则结构变化时改 api-client 的 iam.ts
