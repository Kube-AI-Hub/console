# TC-L3-KUBE-FRONTEND-THEME-CONTRAST-01 外观 · 渲染后文本对比度达到 WCAG AA

- **用例 ID**: `TC-L3-KUBE-FRONTEND-THEME-CONTRAST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `theme` `contrast`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{workspace}/overview`
- **需求**: `prd/kube-frontend/platform-settings/appearance.md`

## 产品功能

在深色与浅色两种外观下打开代表性页面，main 内所有可见文本与其实际背景的对比度达到 WCAG 2.1 AA（4.5:1）；已知未达标的两处登记在用例的已知缺陷清单里，出现新的不达标即失败。

### 关联需求

- `prd/kube-frontend/platform-settings/appearance.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/appearance.md`](../../../../prd/kube-frontend/platform-settings/appearance.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-03** — 已知任意外观组合（深/浅 × 紫/绿），当页面渲染完成，则 `main` 内所有可见文本与其实际背景的对比度达到 WCAG 2.1 AA（正文 4.5:1）；已知未达标的两处（链接强调色在 `--ai-surface-2` 上 2.84:1、成功色徽标在浅色背景 4.07:1）登记在用例的已知缺陷清单中，出现**新的**不达标文本即判失败。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/appearance.md`](../../../../design/kube-frontend/platform-settings/appearance.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/appearance.md`](../../../../prd/kube-frontend/platform-settings/appearance.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 选择看得舒服的外观 (Priority: P2)

作为 **平台读者**，我希望 **在同一处切换深浅色与配色**，以便 **按环境与偏好调整界面，而不必逐页寻找开关**。

**Independent Test**：在平台信息页切换色调为品牌绿，页面主色随之变化；刷新后仍是品牌绿；切回紫罗兰同样生效。

## 前置与配置

- 已登录；外观可切换（ai-kit-theme 写入 localStorage 后由 ThemeProvider 应用）

## 测试步骤

1. 写入 localStorage 的 ai-kit-theme 为目标主题后打开页面
2. 断言 html 的 data-theme 已变为目标主题
3. 用 helpers/contrast.audit 遍历 main 的可见文本节点
4. 对每页每主题重复

## 期望结果

- html[data-theme] 等于目标主题（否则测的是另一个主题）
- 除已登记的两处外，没有对比度低于 4.5:1 的文本
- 已登记项的比值与登记值相差不超过 0.05；若不再复现应删除登记

## 失败排查

- 报告某页对比度不足：先确认 data-theme 真的切了，再看该文本用的是不是填充色令牌当文字色
- 已知缺陷清单报「比值变了」：说明修复已生效，删除对应条目

## 产品改版后如何更新自动化

- 句柄：html[data-theme] / main；辅助函数 helpers/contrast.py 的 audit
