# 老控制台顶部入口（L3）

## 概述

老控制台顶部导航新增「新版控制台」按钮，指向同一地址的 `/kube-frontend/`。这是读者发现新前端的唯一入口，所以它必须与相邻按钮视觉一致，且只在挂载存在时出现。

## 用户故事

### US1 - 作为平台用户，从老控制台一键进入新前端

**Independent Test**：登录老控制台，顶部导航出现「新版控制台」；点击后整页跳转到 `/kube-frontend/`，落在新前端工作台且已是登录态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01** — Given 已登录且新前端已挂载，When 查看顶部导航，Then 「新版控制台」出现在「工作台」之后，按钮高度与相邻项一致、水平间距一致；点击后地址变为 `/kube-frontend/`。

## 设计目标

- 入口与产品开关同源：`client.portal.newConsole` 为真才渲染，避免出现指向 404 的链接。
- 整页跳转，不走 SPA 路由：新前端是另一个应用，`routing.push` 会落到老控制台的 404 路由。

## 约束与边界

- 文案键 `NEW_CONSOLE` 进 13 个 locale 文件；没有翻译的语言用英文，不新增文件。
- 图标用 `computing`（与「算力管理平台」一致），不新造图标。

## UI 交互设计

| 项 | 值 |
|---|---|
| 位置 | 「工作台」之后、「智能体工坊」之前 |
| 图标 | `computing` |
| 文案 | zh 新版控制台 / tc 新版主控台 / 其余 New Console |
| 行为 | `window.location.assign('/kube-frontend/')` |
| 激活态 | `pathname` 以 `/kube-frontend` 开头时高亮（同源时不会命中，因为老控制台 SPA 不再渲染该前缀） |

## 文案与校验

`NEW_CONSOLE` 只在一处定义（`locales/*/l10n-appStore-list.js`），与其他产品入口同文件，便于对照。

## 边界情况

- 未挂载：入口不渲染，导航不出现空位。
- 挂载但新前端 Pod 未就绪：点击后由反代返回 5xx，老控制台本身不受影响。
- 登录回跳：`/login?redirect=/kube-frontend/...` 必须整页跳转，不能被老控制台的 `routing.push` 接管。

## 功能需求

- **FR-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01** — 入口必须与挂载开关同源；点击必须是整页跳转。

## 成功标准

- **SC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01** — 入口按钮与相邻按钮的 y、height 完全一致，水平间距一致。

## 明确不做

- 不做新前端内的「返回老控制台」按钮：新前端已有平台切换器，裸 `/` 属于老控制台，语义不同，容易误点。

## 假设

- 顶部导航的其余产品入口（工作台/工坊/模型/广场）保持现有顺序。

## 验收用例

- `TC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01`
