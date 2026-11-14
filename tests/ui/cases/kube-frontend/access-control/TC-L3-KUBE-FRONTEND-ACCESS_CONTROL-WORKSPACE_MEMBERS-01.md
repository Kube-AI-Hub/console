# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01 企业空间成员 · 邀请、改角色与移除

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01`
- **级别**: LL3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-members`
- **入口**: `{BASE_URL}`
- **需求**: ``

## 产品功能



### 关联需求

- ``

### 覆盖的验收场景

文案来自需求 [``](../../../../)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_MEMBERS-01** — （需求里找不到这条 AC，请先补需求或改 `covers`）

### 关联设计

- 技术方案 [`['design/kube-frontend/access-control/workspace-members.md']`](../../../../['design/kube-frontend/access-control/workspace-members.md'])

## 覆盖的用户故事

文案来自需求 [``](../../../../)，与用例的 `story` 对应；改需求即改这里。

- **prd/kube-frontend/access-control/workspace-members.md#US1** —（需求里找不到这条用户故事，请先补需求或改 `story`）
## 前置与配置

- 已登录且有账号、空间角色读取及成员写入权限
- 空间至少有两个角色；仅操作唯一命名的一次性测试用户

## 测试步骤

1. 创建一次性平台账号并打开空间成员页
2. 邀请账号并选择真实空间角色，回读成员角色
3. 修改为另一个空间角色，回读角色
4. 输入用户名确认移除，回读成员集合与平台账号

## 期望结果

- 两次写入角色与用户选择一致
- 移除后空间成员不存在而平台账号仍在
- finally 移除测试绑定并删除测试账号

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
