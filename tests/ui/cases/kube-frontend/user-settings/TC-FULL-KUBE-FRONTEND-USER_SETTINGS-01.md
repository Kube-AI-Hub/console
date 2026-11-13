# TC-FULL-KUBE-FRONTEND-USER_SETTINGS-01 用户设置 · 从账号菜单打开、两页签切换、关闭不提交

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-USER_SETTINGS-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `user-settings` `page`
- **入口**: `{BASE_URL}/kube-frontend`
- **需求**: `prd/kube-frontend/user-settings/_index.md`

## 产品功能

['登录者从右上角账号菜单打开「用户设置」，弹窗默认落在「基本信息」，两个页签可切换；关闭后回到原页面，没有任何改动被提交。']

### 关联需求

- `prd/kube-frontend/user-settings/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/user-settings/_index.md`](../../../../prd/kube-frontend/user-settings/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-USER_SETTINGS-01** — 已知已登录用户停在任意页面，当从顶栏账号菜单打开「用户设置」，则弹窗默认显示「基本信息」页签，两个页签可互相切换，关闭后回到原页面，且期间没有提交任何改动。

### 关联设计

- 技术方案 [`design/kube-frontend/user-settings/_index.md`](../../../../design/kube-frontend/user-settings/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/user-settings/_index.md`](../../../../prd/kube-frontend/user-settings/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 打开自己的设置并在两个页签之间切换 (Priority: P1)

作为 **登录用户**，我希望 **从右上角用户菜单打开自己的设置，在两个页签之间切换，关闭后回到原处**，以便 **改邮箱或密码时不必离开正在看的页面，也不必请管理员代劳**。

**Independent Test**：登录后停在任意页面（例如 `/kube-frontend/settings/info`），打开账号菜单 → 用户设置，核对默认页签是「基本信息」；切到「密码设置」再切回；关闭弹窗，核对仍在原页面且没有发出任何写请求。

## 前置与配置

- 已登录（任意账号，本用例不需要写账号，用共享登录态即可）

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend
2. 点右上角账号菜单，点「用户设置」
3. 核对默认页签与两个页签各自的内容
4. 切到「密码设置」再切回「基本信息」
5. 点弹窗底部的「关闭」
6. 统计弹窗打开期间页面发出的写请求

## 期望结果

- 弹窗出现，data-ai-state 为 ready
- 默认落在「基本信息」：邮箱输入框可见，密码三项未渲染
- 切到「密码设置」：当前密码、新密码、确认密码可见，邮箱输入框消失
- 切回「基本信息」：邮箱输入框再次可见
- 关闭后弹窗消失，地址与打开前一致，账号菜单仍在
- 打开期间没有发往 /kapis/iam.kubesphere.io/.../users 的写请求

## 失败排查

- 弹窗没出现先看账号菜单里有没有「用户设置」项（shell:user-settings），它是菜单项的 label
- 出现写请求说明切换页签或关闭动作触发了保存

## 产品改版后如何更新自动化

- 文案或入口变化时改 pages/user_settings.py
