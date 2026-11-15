# TC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01 关于与版本

- **用例 ID**: `TC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `user-settings` `about`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/user-settings/about.md`

## 产品功能

右上角用户菜单里的「关于」显示平台名称、描述、控制台版本与 Kubernetes 版本。

### 关联需求

- `prd/kube-frontend/user-settings/about.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/user-settings/about.md`](../../../../prd/kube-frontend/user-settings/about.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-USER_SETTINGS-ABOUT-01** — 已知任意登录用户，当打开右上角用户菜单，则菜单里有「关于」；当点击它，则弹窗显示平台名称（来自平台配置 `kubesphere-config`，未配置时回退到默认名称）、平台描述（有配置时）、控制台版本与 Kubernetes 版本（来自 `/kapis/version` 的 `gitVersion` 与 `kubernetes.gitVersion`）；当版本接口不可用时，弹窗仍打开并显示「版本信息不可用」而不是空白或报错。

### 关联设计

- 技术方案 [`design/kube-frontend/user-settings/about.md`](../../../../design/kube-frontend/user-settings/about.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/user-settings/about.md`](../../../../prd/kube-frontend/user-settings/about.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认平台与版本 (Priority: P1)

作为 **任何登录用户**，我希望 **在用户菜单里打开「关于」看到平台名称、描述与控制台/Kubernetes 版本**，以便 **在报障或对版本时不必去翻部署清单**。

**Independent Test**：打开用户菜单点「关于」，弹窗显示平台名称（取平台配置，未配置时回退到「算力管理平台」）、描述、控制台版本与 Kubernetes 版本。

## 前置与配置

- 已登录

## 测试步骤

1. 打开用户菜单，确认有「关于」
2. 点击「关于」，读取弹窗内容
3. 与服务端 /kapis/version 的返回值对照

## 期望结果

- 版本接口不可用时弹窗仍打开并显示「版本信息不可用」

## 失败排查

- 弹窗空白：版本查询异常时没有降级分支
- 名称写死：未读平台配置

## 产品改版后如何更新自动化

- 选择器：shell:user-menu / shell:about / shell-about:title / :console-version / :kubernetes-version
