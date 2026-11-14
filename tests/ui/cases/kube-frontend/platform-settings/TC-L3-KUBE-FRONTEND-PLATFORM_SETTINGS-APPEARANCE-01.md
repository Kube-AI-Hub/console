# TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-01 外观 · 深浅色与色调切换并保持

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `platform-settings` `appearance`
- **入口**: `{BASE_URL}/kube-frontend/settings/info`
- **需求**: `prd/kube-frontend/platform-settings/appearance.md`

## 产品功能

平台信息页的「外观」分区可切换主题模式与色调；切换立即作用在 <html> 上，刷新后保持。

### 关联需求

- `prd/kube-frontend/platform-settings/appearance.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/appearance.md`](../../../../prd/kube-frontend/platform-settings/appearance.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-APPEARANCE-01** — 打开平台信息页，当点击「品牌绿」，则 `<html data-accent>` 变为 `green`，且当前按钮标记为选中；**AC-…-02** 刷新页面后仍为 `green`。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/appearance.md`](../../../../design/kube-frontend/platform-settings/appearance.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/appearance.md`](../../../../prd/kube-frontend/platform-settings/appearance.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 选择看得舒服的外观 (Priority: P2)

作为 **平台读者**，我希望 **在同一处切换深浅色与配色**，以便 **按环境与偏好调整界面，而不必逐页寻找开关**。

**Independent Test**：在平台信息页切换色调为品牌绿，页面主色随之变化；刷新后仍是品牌绿；切回紫罗兰同样生效。

## 前置与配置

- 已登录

## 测试步骤

1. 打开平台信息页
2. 读取当前 data-theme / data-accent
3. 点击「品牌绿」，再点击「浅色」
4. 刷新页面
5. 切回紫罗兰与深色

## 期望结果

- html[data-accent] 变为 green，按钮标记 aria-checked=true
- html[data-theme] 变为 light
- 刷新后仍为 green / light
- 切回后恢复 violet / dark

## 失败排查

- 切换无效：确认页面用的是 useTheme 而非本地 state
- 刷新回默认：ThemeProvider 的首帧恢复脚本未生效

## 产品改版后如何更新自动化

- 选择器变化时改外观按钮的 data-ai-id（appearance:accent:* / appearance:mode:*）
