# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04 用户列表 · 按名称排序可切换升降序

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

点击名称列排序在升序与降序间切换，列表顺序随之改变。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-04** — 已知用户列表有数据，当点击名称列排序，则顺序变为升序；再次点击，则变为降序（两次结果不同）。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清谁在平台上、是什么角色 (Priority: P1)

作为 **平台管理员**，我希望 **在列表上看到状态与平台角色**，以便 **确认访问范围**。

**Independent Test**：打开用户页，核对四列与某个用户的平台角色注解一致。

## 前置与配置

- 已登录，且有平台权限
- 用户列表至少有两条数据

## 测试步骤

1. 打开用户列表，记录当前顺序
2. 点击名称列排序，记录顺序
3. 再次点击，记录顺序

## 期望结果

- 两次点击后顺序不同
- 一次为升序、一次为降序

## 失败排查

- 点击无效说明排序回调丢弃了 undefined（本页默认降序，首次点击会走该分支）
- 顺序不变说明服务端未收到 sortBy/ascending 参数

## 产品改版后如何更新自动化

- 排序语义变化时改 ai-kit 的 Table.cycleSort 与其单测
