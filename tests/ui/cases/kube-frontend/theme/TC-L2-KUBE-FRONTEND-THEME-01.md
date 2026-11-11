# TC-L2-KUBE-FRONTEND-THEME-01 新前端 · 深浅色切换与刷新保持

- **用例 ID**: `TC-L2-KUBE-FRONTEND-THEME-01`
- **级别**: L2  **套件**: `theme`
- **模块**: `kube-frontend` / `theme` `theme`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/theme.md`

## 产品功能

顶栏可切换深浅色，切换即时生效并在刷新后保持，首屏不闪。

### 关联需求

- `prd/kube-frontend/theme.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/theme.md`](../../../../prd/kube-frontend/theme.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L2-KUBE-FRONTEND-THEME-01** — Given 默认打开页面，When 渲染完成，Then 根元素为 `data-theme="dark"` 且 `data-accent="violet"`。
- **AC-L2-KUBE-FRONTEND-THEME-02** — Given 页面为深色，When 点击顶栏切换按钮，Then `data-theme` 变为 `light`，页面背景与文字对比度不低于 4.5:1，`aria-pressed` 同步为 `false`。
- **AC-L2-KUBE-FRONTEND-THEME-03** — Given 已选择浅色，When 刷新页面，Then 首屏即为浅色，不出现一帧深色。

### 关联设计

- 技术方案 [`design/kube-frontend/theme.md`](../../../../design/kube-frontend/theme.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/theme.md`](../../../../prd/kube-frontend/theme.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为主要夜间使用的用户，切换到浅色后刷新仍是浅色


**Independent Test**：点顶栏的切换按钮，页面整体转为浅色；刷新后仍是浅色，且没有先黑后白的闪帧。

## 前置与配置

- 已登录，localStorage 中没有 ai-kit-theme

## 测试步骤

1. 打开配置字典列表，读取 <html> 的 data-theme 与 data-accent
2. 点击顶栏的深浅色切换按钮
3. 读取 <html> 的 data-theme 与 body 的计算背景色
4. 刷新页面，立即读取 <html> 的 data-theme

## 期望结果

- 第一步为 dark / violet
- 第三步变为 light，body 背景为浅色，切换按钮 aria-pressed 为 false
- 第四步立即为 light，不出现一帧 dark

## 失败排查

- 刷新后先 dark 再 light 说明 index.html 的引导脚本缺失或被移除
- 弹层仍是深色说明属性挂在了容器上而不是 html 上

## 产品改版后如何更新自动化

- 存储键变化时同步 index.html 与 ThemeProvider
