# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-02 平台角色 · 创建与删除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `platform-roles`
- **入口**: `{BASE_URL}/kube-frontend/access/clusterroles`
- **需求**: `prd/kube-frontend/access-control/platform-roles.md`

## 产品功能

平台角色可由「创建」建立，规则写入 RBAC；模板角色不提供编辑与删除。

### 关联需求

- `prd/kube-frontend/access-control/platform-roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-02** — 已知在平台角色页，当点「创建」填写名称、资源与动作并确认，则该角色的 `rules` 写入且 `apiGroups` 为核心组的 `[""]`；当删除，则角色不存在；当查看 `role-template-*` 角色，则其行没有操作菜单。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/platform-roles.md`](../../../../design/kube-frontend/access-control/platform-roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清平台上有哪些角色 (Priority: P1)

作为 **平台管理员**，我希望 **看到规则数与是否模板**，以便 **区分可分配与内置角色**。

**Independent Test**：打开平台角色页，核对列与某个角色行。

## 前置与配置

- 已登录，且有平台权限
- 用例自行创建的角色在结束时无条件删除（走原生 RBAC 接口）

## 测试步骤

1. 打开平台角色页并点「创建」
2. 填写名称、别名、资源与动作预设，点确认
3. 用原生 RBAC 接口读取该角色
4. 回到列表删除该角色
5. 另取一个 role-template-* 角色查看行操作

## 期望结果

- 创建后 rules 非空，且 apiGroups 为 ['']（核心组），resources 为填写的两项
- 删除后该角色不存在
- 模板角色的行操作中没有编辑与删除

## 失败排查

- rules 为空说明写到了 iam.kubesphere.io（该层会丢弃规则）
- 422 且提示 apiGroups 时确认空组被写成 [''] 而不是 []

## 产品改版后如何更新自动化

- 规则编辑器变化时改 pages/platform_settings.py 或 access_control.py
