# TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03 项目成员 · 搜索、自我保护与批量移除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `project-settings` `members`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/members`
- **需求**: `prd/kube-frontend/project-settings/members.md`

## 产品功能

成员列表按名称过滤、展示邮箱，当前用户不可勾选或改绑，批量移除用人数确认。

### 关联需求

- `prd/kube-frontend/project-settings/members.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/project-settings/members.md`](../../../../prd/kube-frontend/project-settings/members.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PROJECT_SETTINGS-MEMBERS-03** — 已知成员列表可读，当打开成员页，则用户名下显示邮箱；可按名称搜索；当前登录用户不可勾选、无修改/移除菜单；批量移除需输入选中人数确认，且不包含自己。

### 关联设计

- 技术方案 [`design/kube-frontend/project-settings/members.md`](../../../../design/kube-frontend/project-settings/members.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/project-settings/members.md`](../../../../prd/kube-frontend/project-settings/members.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 在成员表上找到人且不能操作自己 (Priority: P1)

作为 **项目管理员**，我希望 **按名称搜索、看到邮箱，并且不能改或移除自己**，以便 **日常查人时不会把自己踢出项目**。

**Independent Test**：打开成员页，搜索已知成员能收窄列表；当前登录用户没有行菜单和复选框；批量移除需输入选中人数确认。

## 前置与配置

- 已登录且对 default 项目有管理权限
- 项目至少有一个可分配角色
- 仅操作唯一命名的一次性测试用户

## 测试步骤

1. 创建两个一次性平台账号并写入项目成员
2. 打开成员页，用前缀搜索，两行均含邮箱
3. 清空搜索后核当前用户行没有复选框
4. 再搜前缀，勾选两行，点批量移除并输入人数 2
5. 回读项目成员集合与平台账号

## 期望结果

- 搜索后只剩测试前缀的两行
- 当前登录用户不可勾选
- 批量确认后两名测试成员解绑，平台账号仍在
- finally 删除测试账号

## 失败排查

- 当前用户仍能勾选：isRowSelectable 未排除当前用户
- 批量按钮要输入拼接用户名：DeleteDialog 批量确认词应是人数

## 产品改版后如何更新自动化

- 选择器见 SettingsListPage.tsx 的 members:search / members:bulk-remove
