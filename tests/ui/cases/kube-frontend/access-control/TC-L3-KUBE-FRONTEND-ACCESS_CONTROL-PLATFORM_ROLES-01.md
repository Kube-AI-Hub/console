# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01 平台角色 · 列表三列与模板徽标

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `platform-roles`
- **入口**: `{BASE_URL}/kube-frontend/access/clusterroles`
- **需求**: `prd/kube-frontend/access-control/platform-roles.md`

## 产品功能

['平', '台', '角', '色', None, '·', None, '列', '表', '三', '列', '与', '模', '板', '徽', '标', '：', '列', '集', '合', '与', '老', None, 'c', 'o', 'n', 's', 'o', 'l', 'e', None, '一', '致', '。']

### 关联需求

- `prd/kube-frontend/access-control/platform-roles.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-PLATFORM_ROLES-01** — 已知平台上有角色，当打开平台角色页，则显示名称、规则数、创建时间三列，且 `role-template-*` 行带「模板」徽标。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/platform-roles.md`](../../../../design/kube-frontend/access-control/platform-roles.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/platform-roles.md`](../../../../prd/kube-frontend/access-control/platform-roles.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清平台上有哪些角色 (Priority: P1)

作为 **平台管理员**，我希望 **看到规则数与是否模板**，以便 **区分可分配与内置角色**。

**Independent Test**：打开平台角色页，核对列与某个角色行。

## 前置与配置

- 已登录，且有平台权限
- 该页至少有一条数据（用例先用 API 确认）

## 测试步骤

1. 打开该页
2. 核对表头
3. 读取第一行

## 期望结果

- 表头依次为 ["名称", "规则数", "创建时间"]
- 第一行有内容

## 失败排查

- 缺列时看 PlatformListPage 的 columns
- 空列表时用例 skip 而不是失败

## 产品改版后如何更新自动化

- 列变化时改 pages/access_control.py
