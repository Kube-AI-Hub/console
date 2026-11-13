# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06 用户列表 · 编辑邮箱与描述

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

在用户列表对某人「编辑信息」：改邮箱与描述，保存后回读 spec.email 与 kubesphere.io/description 注解；邮箱非法时拦截。

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-06** — 已知平台上有用户，当对某人执行「编辑信息」并填写新的邮箱与描述后保存，则该用户的 `spec.email` 变为新邮箱、`kubesphere.io/description` 注解变为新描述；邮箱非法时提交被拦下并提示。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 修正账号的邮箱与描述 (Priority: P2)

作为 **平台管理员**，我希望 **改掉用户的邮箱与描述**，以便 **账号信息与本人对得上**。

**Independent Test**：创建临时用户 → 编辑邮箱与描述 → 回读两个字段 → 删除。

## 前置与配置

- 已登录平台管理
- 用例自行创建临时用户（tc-e2e- 前缀），finally 中删除

## 测试步骤

1. 用 API 创建临时用户（邮箱 A）
2. 在用户列表搜索该用户，执行「编辑信息」
3. 弹出窗口后把邮箱改为 B、描述改为文本并保存
4. 用 API 回读 spec.email 与 description 注解

## 期望结果

- 弹窗打开后邮箱输入框有初始值
- 保存后 spec.email 等于 B，description 注解等于输入描述
- 邮箱非法时提交被拦下并提示

## 失败排查

- 保存返回 405：编辑走了 PATCH，必须 GET 后 PUT
- 邮箱没变：写到了注解而不是 spec.email
- 弹窗为空：打开时没有读取用户详情（列表行不含描述）

## 产品改版后如何更新自动化

- 选择器见 pages/access_control.py 与 UserEditDialog.tsx
