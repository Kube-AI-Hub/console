# TC-L2-KUBE-FRONTEND-HELP-01 顶栏帮助菜单：两种语言、新窗口、配置兜底

- **用例 ID**: `TC-L2-KUBE-FRONTEND-HELP-01`
- **级别**: L2  **套件**: `point`
- **模块**: `kube-frontend` / `help` `help-entry`
- **入口**: `{BASE_URL}/kube-frontend/`
- **需求**: `prd/kube-frontend/help.md`

## 产品功能

登录后顶栏右侧有「帮助与文档」图标；菜单两项（用户指南 / API 文档）使用 GET /api/config 下发的当前语言地址（未配置时用旧 console 的相对路径），点击在新窗口打开且 noopener；部署显式置空时不渲染该项/整个入口。

### 关联需求

- `prd/kube-frontend/help.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/help.md`](../../../../prd/kube-frontend/help.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L2-KUBE-FRONTEND-HELP-01** — Given 已登录且部署提供两种语言的文档地址，When 查看顶栏，Then 出现帮助图标（可访问名称为「帮助与文档」）；点开后有两项「用户指南 / API 文档」，分别对应当前语言（中文 → `documents.zh`，英文 → `documents.en`）的 URL；点击后在新窗口打开该 URL，且 opener 关系被切断（`noopener`）。
- **AC-L2-KUBE-FRONTEND-HELP-02** — Given 部署通过 BFF 环境变量覆盖文档地址，When 打开帮助菜单，Then 使用覆盖后的地址；Given `GET /api/config` 读取失败，Then 使用旧 console 的内置相对路径（`/kube-docs/...`）而不是隐藏菜单；Given 某项地址被显式置空，Then 该项不渲染（不产生死链），两项都空时帮助图标整体不渲染。
- **AC-L2-KUBE-FRONTEND-HELP-03** — Given 读者在中文与英文之间切换，When 再次打开帮助菜单，Then 链接随语言切换（同一菜单不缓存上一种语言的地址）；菜单不触发整页跳转。

### 关联设计

- 技术方案 [`design/kube-frontend/help.md`](../../../../design/kube-frontend/help.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/help.md`](../../../../prd/kube-frontend/help.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 从控制台直接找到对应语言的文档

作为 **平台用户**，我希望 **在顶栏点开帮助菜单，选择用户指南或 API 文档**，以便 **不记得文档域名或路径时也能一步到达，并保持当前语言**。

**Independent Test**：登录后顶栏出现帮助图标；点开显示「用户指南 / API 文档」两项；点击任一项在新窗口打开对应语言的文档地址；切换语言后再打开，链接跟随语言变化。

### US2 - 部署方决定文档地址，未提供时不出现死链

作为 **部署/运维人员**，我希望 **通过部署配置指定文档地址；如果这个部署没有文档，入口就不显示**，以便 **不需要改前端代码，也不会把用户带到 404**。

**Independent Test**：BFF 环境变量配置文档地址后，菜单使用该地址；显式置空时帮助下图标不渲染；配置接口失败时使用旧 console 的相对路径兜底，菜单仍可用。

## 前置与配置

- 已登录；BFF 提供 GET /api/config（默认文档地址可用）
- 远程测试环境当前不可达时本用例记录为环境阻塞，不伪造通过

## 测试步骤

1. 登录后打开任意控制台页面，等待顶栏渲染
2. 确认帮助按钮存在且可访问名称为「帮助与文档」
3. 点开菜单，确认「用户指南」「API 文档」两项可见
4. 用 Playwright 捕获新窗口点击「用户指南」，核对新窗口 URL 与当前语言配置的 url 一致
5. 尝试读取新窗口 window.opener，确认被切断（noopener）
6. 通过语言切换改为英文，再打开菜单，核对菜单项仍为两项（URL 变为 en 配置）

## 期望结果

- 帮助图标可见且不造成顶栏换行/溢出
- 两项菜单使用当前语言 URL；点击新窗口打开；window.opener 为 null
- 配置接口失败时菜单仍显示（内置 /kube-docs/... 兜底）；显式空 URL 不产生死链（本用例默认部署走默认值，空值分支由单测覆盖）

## 失败排查

- 菜单不出现：确认 AppShell 顶栏挂载了 HelpMenu，且 /api/config 返回 documents 非空
- 点击无反应/被拦截：window.open 必须在 onSelect 同步栈内；确认菜单项未被 Radix 延迟
- URL 语言不对：确认 helpLinksFor 用当前 locale 选择 zh/en，而不是浏览器语言
- 新窗口 opener 非空：window.open 第三参必须含 noopener

## 产品改版后如何更新自动化

- 句柄：shell:help-menu、shell:docs-guide、shell:docs-api
