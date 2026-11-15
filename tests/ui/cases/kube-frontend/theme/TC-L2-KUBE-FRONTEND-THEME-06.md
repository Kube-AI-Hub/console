# TC-L2-KUBE-FRONTEND-THEME-06 浅色主题与第二色调 · 禁用态可读性

- **用例 ID**: `TC-L2-KUBE-FRONTEND-THEME-06`
- **级别**: L2  **套件**: `point`
- **模块**: `kube-frontend` / `theme` `theme`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/theme.md`

## 产品功能

浅色主题（violet 与 green 两种色调）下关键页面可读；禁用态实心按钮呈中性表面与弱化文字、无透明度衰减，不再是半透明的实心色。

### 关联需求

- `prd/kube-frontend/theme.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/theme.md`](../../../../prd/kube-frontend/theme.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L2-KUBE-FRONTEND-THEME-06** — 已知页面处于浅色（`data-theme="light"`），当查看**禁用态**的实心按钮（如未选中行时的「批量删除」），则按钮呈现中性表面 + 弱化文字、无阴影、`opacity` 为 1，且不保留 danger/primary 的实心填充色；在深色下同样成立；`data-accent="green"` 时浅色页面的背景与强调色随 token 切换，页面无横向溢出。

### 关联设计

- 技术方案 [`design/kube-frontend/theme.md`](../../../../design/kube-frontend/theme.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/theme.md`](../../../../prd/kube-frontend/theme.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为主要夜间使用的用户，切换到浅色后刷新仍是浅色


**Independent Test**：点顶栏的切换按钮，页面整体转为浅色；刷新后仍是浅色，且没有先黑后白的闪帧。

## 前置与配置

- 已登录；可访问项目配置字典页

## 测试步骤

1. 设置 ai-kit-theme=light、ai-kit-accent=violet，打开配置字典页，核对根元素属性与 body 背景
2. 读取未选中行时「批量删除」按钮的计算样式（背景/前景/opacity）
3. 切到 ai-kit-accent=green，核对根元素属性、body 背景变化且无横向溢出
4. 切回 dark，核对同一按钮同样是中性表面

## 期望结果

- data-theme=light 且 data-accent 跟随所选色调；body 背景为浅色（亮度 > 0.9）
- 禁用按钮 opacity=1，背景不等于 danger 实心色（不是 rgb(171,47,41) 一类），前景为弱化文字色
- 深色下同一按钮也不带 danger 实心填充
- 三档视口无横向溢出

## 失败排查

- 禁用按钮仍是实心红：Button 基础类又退回 disabled:opacity-50
- 浅色下文字看不清：组件里用了硬编码颜色而不是 --ai-* token

## 产品改版后如何更新自动化

- 存储键：ai-kit-theme / ai-kit-accent；根属性：data-theme / data-accent；按钮句柄：configmaps:bulk-delete
