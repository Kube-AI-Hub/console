# TC-L2-KUBE-FRONTEND-THEME-02 新前端 · 手机宽度下的主题切换按钮

- **用例 ID**: `TC-L2-KUBE-FRONTEND-THEME-02`
- **级别**: L2  **套件**: `theme`
- **模块**: `kube-frontend` / `theme` `theme`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/theme.md`

## 产品功能

手机宽度下切换按钮可点中，且弹层与页面同主题。

### 关联需求

- `prd/kube-frontend/theme.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/theme.md`](../../../../prd/kube-frontend/theme.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L2-KUBE-FRONTEND-THEME-04** — Given 任一主题，When 打开下拉菜单或弹窗，Then 弹层使用与页面相同的主题（portal 渲染到根元素，仍取到 token）。
- **AC-L2-KUBE-FRONTEND-THEME-05** — Given 手机宽度（390px），When 查看顶栏，Then 切换按钮高度不小于 44px，与相邻按钮同高，页面无横向滚动。

### 关联设计

- 技术方案 [`design/kube-frontend/theme.md`](../../../../design/kube-frontend/theme.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/theme.md`](../../../../prd/kube-frontend/theme.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为在手机上看列表的用户，能点中切换按钮


**Independent Test**：375px 宽视口下切换按钮高度不小于 44px，与语言切换、账号菜单同一行且不换行。

## 前置与配置

- 已登录，视口宽度 390px

## 测试步骤

1. 打开配置字典列表
2. 测量切换按钮与语言切换按钮的高度
3. 检查页面是否出现横向滚动
4. 打开某行的「更多操作」菜单，读取其计算背景色

## 期望结果

- 两个按钮高度一致且不小于 44px
- 无横向滚动，顶栏各按钮在同一行
- 菜单背景为当前主题的浅色或深色，而不是固定的白或黑

## 失败排查

- 按钮偏小说明调用处没有覆盖 size-9
- 菜单背景与页面不一致时检查是否给容器而非 html 设了主题属性

## 产品改版后如何更新自动化

- 顶栏布局调整时同步本用例的尺寸断言
