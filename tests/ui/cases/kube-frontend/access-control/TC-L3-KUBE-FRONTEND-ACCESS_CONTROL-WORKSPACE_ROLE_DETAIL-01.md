# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01 企业空间角色详情 · 规则明细与绑定成员数

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-role-detail`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/public/roles/public-admin`
- **需求**: `prd/kube-frontend/access-control/workspace-role-detail.md`

## 产品功能

企业空间作用的只读角色详情：从角色列表进入，展示基本信息、规则表（API 组/资源/动作）与绑定成员数。

### 关联需求

- `prd/kube-frontend/access-control/workspace-role-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-role-detail.md`](../../../../prd/kube-frontend/access-control/workspace-role-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_ROLE_DETAIL-01** — 已知企业空间 `<ws>` 的角色 `<name>` 有 R 条规则（R 可能为 0）且被 M 个成员持有（M 可能为 0），当从角色列表进入该角色详情，则显示角色名、别名/描述（缺失为 `-`）、创建者与创建时间，规则表列出 R 行（API 组 / 资源 / 动作），成员计数为 M 并列出持有者用户名；R 为 0 时显示「该角色没有规则」；角色不存在或读取失败时显示错误面板与重试，而不是空白页。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-role-detail.md`](../../../../design/kube-frontend/access-control/workspace-role-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-role-detail.md`](../../../../prd/kube-frontend/access-control/workspace-role-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 企业空间管理员核对一个角色的权限与持有人 (Priority: P1)

作为 **企业空间管理员**，我希望 **打开一个角色看到它的规则明细和绑定成员数**，以便 **在授权前确认这个角色到底能做什么、目前谁已经拥有它**。

**Independent Test**：从角色列表点击一个角色名进入详情，核对规则条数与接口 `rules` 数组长度一致、成员数与 `workspacemembers` 中角色注解匹配的条数一致。

## 前置与配置

- 已登录，且至少有一个企业空间带可读的 workspaceroles
- 该空间 workspacemembers 可读（可能没有任何成员）

## 测试步骤

1. 用 API 读企业空间列表，选一个有角色的空间
2. 读该空间 workspaceroles?limit=-1，取第一页内第一个有规则的角色（没有则取第一个）
3. 读该角色详情得到 rules 数组，读 workspacemembers 按 iam.kubesphere.io/workspacerole 注解过滤得到期望成员数 M
4. 打开该空间的 /roles 列表页，点击角色名链接进入详情
5. 等待 workspace-role-detail:surface 离开 loading
6. 核对名称、规则数、规则表行数/空态、成员计数与成员列表

## 期望结果

- surface 可见且 data-ai-state 为 ready
- 标题/名称等于角色别名或对象名
- 规则数文本等于 rules 长度；rules 非空时表格行数等于长度，为空时显示 workspace-role-detail:empty-rules
- 成员计数文本等于 M；M 大于 0 时成员列表行数等于 M

## 失败排查

- 详情 404：路径必须带 workspaces/<ws>/workspaceroles/<name>，name 要 encodeURIComponent
- 规则数与列表页不一致：详情读的是 role 对象 rules，不是 aggregation-roles 注解展开
- 成员计数恒 0：角色注解键写错（应为 iam.kubesphere.io/workspacerole），或读了 rolebindings
- 列表点击无跳转：roles 列表名称列没有 Link 到 /workspaces/$workspace/roles/$name

## 产品改版后如何更新自动化

- 选择器：workspace-roles:name:<name>、workspace-role-detail:surface/rule-count/rule-table/member-count/member-list
