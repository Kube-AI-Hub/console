# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02 项目角色 · 编辑权限

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `roles`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/roles`
- **需求**: `prd/kube-frontend/project-settings/roles.md`

## 产品功能

角色行操作含「编辑权限」；对话框先开再加载规则；提交后 rules 被整体替换。

### 关联需求

- `prd/kube-frontend/project-settings/roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-ROLES-02** — 已知角色列表中有一个非模板角色，当「编辑信息」并填写别名，则该角色的 `kubesphere.io/alias-name` 注解被更新；当「删除」并确认，则该角色从列表消失且 API 返回 404。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/roles.md`](../../../../design/kube-frontend/project-settings/roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/roles.md`](../../../../prd/kube-frontend/project-settings/roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些角色、各有多少规则 (Priority: P1)

作为 **项目管理员**，我希望 **在列表上看到规则数与是否模板**，以便 **判断哪些是可分配的角色**。

**Independent Test**：打开角色列表，核对列与模板徽标。

## 前置与配置

- 由夹具通过原生 RBAC 创建一个带一条规则的项目角色，用例结束无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 打开角色列表，读取行操作
2. 点「编辑权限」，读取文本框内容
3. 改为两行规则并确认
4. 用 API 读取 rules

## 期望结果

- 行操作含 编辑权限
- 对话框出现且已载入原规则（形如 ` | pods | get`）
- 提交后 rules 为两条，第一条 apiGroups 为 ['']（核心组）

## 失败排查

- 对话框空白说明加载态没有被替换
- 只有一条规则说明没有整体替换，而是追加

## 产品改版后如何更新自动化

- 规则格式变化时改 api-client 的 projectRolesWriteApi
