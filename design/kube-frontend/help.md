# 帮助与文档入口 · 技术方案（L2）

> 本文承接 [`prd/kube-frontend/help.md`](../../prd/kube-frontend/help.md) 的全部 `AC-*`。

## 概述

顶栏帮助菜单 = 两个外链（用户指南 / API 文档）。地址是部署属性，不是构建属性：BFF 暴露 `GET /api/config`，SPA 在 Header 里读取并按当前语言选 URL。读取失败时用旧 console 的相对路径兜底；部署显式置空则隐藏入口。

## 关联需求

- `AC-L2-KUBE-FRONTEND-HELP-01`
- `AC-L2-KUBE-FRONTEND-HELP-02`
- `AC-L2-KUBE-FRONTEND-HELP-03`

## 设计目标与非目标

**目标**：部署可配置、失败可兜底、空值不产生死链、语言跟随、新窗口安全打开。

**非目标**：站内文档阅读器、搜索、反馈入口、用户级地址。

## 方案决策

### DEC-L2-KUBE-FRONTEND-HELP-01 — 地址由 BFF `/api/config` 下发，不走构建期变量

**为什么**：同一个镜像会部署到不同环境（文档域名/语言路径不同）。构建期变量要求每个环境重新构建；而旧 console 的文档地址本来就来自其运行时服务端配置（`client.documents`），新 BFF 就是那个服务端。`/api/config` 不带鉴权，因为只含公开地址，登录页将来也可复用。

**被否方案**：
1. 构建期 `VITE_DOCS_*`：多环境要多次构建，且与旧 console 的运行时配置语义不一致。
2. 读平台 ConfigMap：那是集群/平台配置，不是控制台文档配置；把控制台属性塞进集群资源会让「谁负责改」错位。

**何时重新考虑**：如果平台需要按租户给不同文档站，则改为登录后接口并带租户参数。

### DEC-L2-KUBE-FRONTEND-HELP-02 — 未配置 = 内置相对路径；显式空 = 隐藏

**为什么**：旧 console 的配置文件始终带着 `/kube-docs/...` 默认值，所以「没配」实际上仍可用；而新部署可能根本没有文档站，需要能明确关掉。两者合成一个状态会让「没配」要么变成死链，要么把默认文档误删。实现上：环境变量未设置 → 默认；设置为空字符串 → 空 URL → client 过滤掉该项；两项都空 → 不渲染图标。

**被否方案**：空值一律回落默认。这样无法关闭入口，违反 N-28 的「无配置时不显示」。

**何时重新考虑**：如果部署配置改成显式 `enabled` 开关。

### DEC-L2-KUBE-FRONTEND-HELP-03 — 语言在客户端选择，新窗口 `noopener`

**为什么**：BFF 一次返回两种语言，避免为切换语言再请求；旧 console 也是 `documents[lang]` 二选一。外链必须新窗口且 `noopener`：文档站不应能通过 `window.opener` 操作控制台。

**被否方案**：服务端按 Accept-Language 只返回一种语言。切换语言就要重取配置，且与服务端语言协商和前端 locale 可能不一致。

**何时重新考虑**：若文档站需要控制台传入登录态（反向嵌入），改为受控的 iframe 方案另立需求。

## 系统现状

旧 console：`components/Layout/Header/index.jsx` 的 documentation 下拉，两项来自 `getWebsiteUrl()`（`globals.config.documents[lang]`，默认 `/kube-docs/...`），点击新窗口打开。新前端此前顶栏无帮助入口（N-28）。

## 仓库落点

- `server/src/docs.ts`（`loadDocs` / `DEFAULT_DOCS`）、`server/src/index.ts` 的 `GET /api/config`
- `packages/api-client/src/config.ts`（`publicConfigApi` / `DEFAULT_DOCUMENTS`）
- `apps/console-next/src/shell/HelpMenu.tsx`，在 `AppShell` 顶栏语言切换之前挂载
- 文案：`packages/locales/src/index.ts` 的 `shell.help` / `shell.userGuide` / `shell.apiDocs`

## 对外契约

`GET /api/config`（无鉴权）→
```json
{ "documents": { "zh": { "url": "...", "api": "..." }, "en": { "url": "...", "api": "..." } } }
```
环境变量：`KS_DOCS_URL_ZH`、`KS_DOCS_API_ZH`、`KS_DOCS_URL_EN`、`KS_DOCS_API_EN`；未设置用默认，空字符串表示该部署没有该文档。

## 不变量

1. 菜单 URL = 当前语言下配置的 URL；配置读失败用内置相对路径。
2. 空 URL 不渲染成菜单项；两项都空时帮助图标不渲染。
3. 外链一律新窗口 + `noopener`，不改变控制台地址。
4. 配置未返回前不渲染图标，避免顶栏布局跳动。

## 已知坑

- **不要把「读失败」和「显式空」合并**：前者应兜底默认，后者应隐藏；合并后要么关不掉入口，要么一次网络抖动就让帮助入口消失。
- `window.open` 必须在用户手势的同步调用栈内（菜单项点击），否则会被弹窗拦截；不要在 `await` 之后才打开。

## 测试与可观测

- BFF：`server/test/config.test.ts`（默认、覆盖、显式空、非 GET 405）
- API 客户端：`packages/api-client/test/public-config.test.ts`（路径、兜底常量）
- 组件：`apps/console-next/test/help-menu.test.tsx`（语言选择、空值过滤、无文档时不渲染、可访问名）
- 句柄：`shell:help-menu`、`shell:docs-guide`、`shell:docs-api`
- E2E：`TC-L2-KUBE-FRONTEND-HELP-01`（环境恢复后执行；当前远程后端不可达）

## 后续改进

- 页面级上下文帮助（`pageTip` 已有独立机制，不并入本菜单）。
- 若平台需要按租户定制文档站，再评估登录后的配置接口。

## 验收用例

- `TC-L2-KUBE-FRONTEND-HELP-01`
