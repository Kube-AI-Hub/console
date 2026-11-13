# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01 用户 · 列表四列

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `users`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/users.md`

## 产品功能

['用', '户', None, '·', None, '列', '表', '四', '列', '：', '列', '集', '合', '与', '老', None, 'c', 'o', 'n', 's', 'o', 'l', 'e', None, '一', '致', '。']

### 关联需求

- `prd/kube-frontend/access-control/users.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USERS-01** — 已知平台上有用户，当打开用户页，则显示用户名、状态、平台角色、最近登录四列。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/users.md`](../../../../design/kube-frontend/access-control/users.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/users.md`](../../../../prd/kube-frontend/access-control/users.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清谁在平台上、是什么角色 (Priority: P1)

作为 **平台管理员**，我希望 **在列表上看到状态与平台角色**，以便 **确认访问范围**。

**Independent Test**：打开用户页，核对四列与某个用户的平台角色注解一致。

## 前置与配置

- 已登录，且有平台权限
- 该页至少有一条数据（用例先用 API 确认）

## 测试步骤

1. 打开该页
2. 核对表头
3. 读取第一行

## 期望结果

- 表头依次为 ["用户名", "状态", "平台角色", "最近登录"]
- 第一行有内容

## 失败排查

- 缺列时看 PlatformListPage 的 columns
- 空列表时用例 skip 而不是失败

## 产品改版后如何更新自动化

- 列变化时改 pages/access_control.py
