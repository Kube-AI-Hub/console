# TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-02 访问控制 · 根路径进入用户表

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-02`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `access-control` `page`
- **入口**: `{BASE_URL}/kube-frontend/access`
- **需求**: `prd/kube-frontend/access-control/_index.md`

## 产品功能

打开访问控制根路径后落到用户表，三页签可见且用户页签高亮，不是空白布局。

### 关联需求

- `prd/kube-frontend/access-control/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/_index.md`](../../../../prd/kube-frontend/access-control/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-02** — 已知已登录且有平台权限，当打开 `/kube-frontend/access`（无页签段），则客户端重定向到 `/kube-frontend/access/users`，显示用户列表（或空态）与三页签，且「用户」页签高亮。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/_index.md`](../../../../design/kube-frontend/access-control/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/_index.md`](../../../../prd/kube-frontend/access-control/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 从访问控制根路径进入用户表 (Priority: P1)

作为 **平台管理员**，我希望 **打开 `/kube-frontend/access` 或点侧栏「访问控制」就能看到用户表**，以便 **不必记住子路径、也不面对空白页**。

**Independent Test**：打开 `/kube-frontend/access`，核对 URL 落到 `/kube-frontend/access/users`，用户页签高亮，列表或空态可见。

## 前置与配置

- 已登录，且有平台权限

## 测试步骤

1. 打开 /kube-frontend/access
2. 等待地址落到 /kube-frontend/access/users
3. 核对用户表面板与页签

## 期望结果

- URL 以 /kube-frontend/access/users 结尾
- 用户表面板可见
- 用户页签 aria-current=page
- 页面出现「用户」「平台角色」「租户(企业空间)」三个页签
- 页面不出现 workspace-bar

## 失败排查

- 仍停在 /access 且 data-area-page 为空：缺 kube-frontend.access/index.tsx，或 dist 未重建
- 有列表但无页签：布局 areaOfPage 没拿到 users segment

## 产品改版后如何更新自动化

- 默认页变化时改 routes/kube-frontend.access/index.tsx 与 areas/registry.ts 的 defaultPage
