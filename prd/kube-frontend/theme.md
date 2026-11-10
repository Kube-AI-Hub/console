# 主题（L2）

## 概述

新前端跟随 ai-kit 的设计 token 提供深浅两套配色，顶栏提供切换入口。偏好保存在 `localStorage`，并在首屏渲染前恢复，避免闪色。

## 用户故事

### US1 - 作为主要夜间使用的用户，切换到浅色后刷新仍是浅色

**Independent Test**：点顶栏的切换按钮，页面整体转为浅色；刷新后仍是浅色，且没有先黑后白的闪帧。

### US2 - 作为在手机上看列表的用户，能点中切换按钮

**Independent Test**：375px 宽视口下切换按钮高度不小于 44px，与语言切换、账号菜单同一行且不换行。

## 验收场景

- **AC-L2-KUBE-FRONTEND-THEME-01** — Given 默认打开页面，When 渲染完成，Then 根元素为 `data-theme="dark"` 且 `data-accent="violet"`。
- **AC-L2-KUBE-FRONTEND-THEME-02** — Given 页面为深色，When 点击顶栏切换按钮，Then `data-theme` 变为 `light`，页面背景与文字对比度不低于 4.5:1，`aria-pressed` 同步为 `false`。
- **AC-L2-KUBE-FRONTEND-THEME-03** — Given 已选择浅色，When 刷新页面，Then 首屏即为浅色，不出现一帧深色。
- **AC-L2-KUBE-FRONTEND-THEME-04** — Given 任一主题，When 打开下拉菜单或弹窗，Then 弹层使用与页面相同的主题（portal 渲染到根元素，仍取到 token）。
- **AC-L2-KUBE-FRONTEND-THEME-05** — Given 手机宽度（390px），When 查看顶栏，Then 切换按钮高度不小于 44px，与相邻按钮同高，页面无横向滚动。

## 设计目标

- 组件不感知主题：只使用 `--ai-*` 语义 token，主题由根元素属性驱动。
- 切换无闪烁：属性在首屏前由内联脚本设置，React 只负责之后的状态。
- 与 playbook 一致：同一个 `ThemeProvider` / `ThemeToggle`，同一组存储键。

## 约束与边界

- 只做深浅色，不做色调（violet / green）切换；`data-accent` 固定为紫色，但仍由引导脚本从存储恢复，以免在 playbook 里选过配色的人进来后跳变。
- 不跟随系统 `prefers-color-scheme`：老 console 与 playbook 都没有第三种状态，引入会让「我的选择」与「系统选择」产生歧义。
- 组件里不允许出现硬编码颜色（`bg-white`、`text-gray-*`、`bg-[#...]`），否则浅色下必然失效。

## 明确不做

- 每个用户的服务端偏好持久化（老 console 也没有；换设备需重新选）。
- 自定义主题色板。

## 假设

- ai-kit 的 `tokens.css` 通过 `:root[data-theme='light']` 覆盖全部语义层，因此在 `<html>` 上换属性即可全局生效。
