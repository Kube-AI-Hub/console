# 老控制台顶部入口 — 技术方案

[子模块技术方案](./_index.md)

**技术方案 ID**：`DES-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01`

## 概述

`renderProductEntry` 用一个字典把入口名映射到文案、图标与点击行为；`visibleProductEntries` 决定顺序与可见性。新入口加进这两处，不新增组件。

## 关联需求

- `AC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01`

## 设计目标与非目标

- **目标**：入口与挂载开关同源；与相邻按钮视觉一致；点击是整页跳转。
- **非目标**：在新前端里加「返回老控制台」按钮。

## 关键约束

- 顶部导航是既有组件，不能因为新增一项而改变其他项的间距或高度。
- 文案必须进 locale 文件，不能硬编码中文。

## 方案决策

### DEC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01：可见性与挂载共用 `portal.newConsole`

- **备选**：前端写死入口（否决）／配置项同时控制两件事（选定）。
- **原因**：一个配置项同时控制反代与入口，不可能出现「有入口但没挂载」。
- **被否方案**：写死入口——关掉挂载后顶部会留一个指向 404 的按钮。
- **何时重新考虑**：如果出现「挂载但不显示入口」的真实需求（例如灰度）。

### DEC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-02：整页跳转，并加进 `pathRequiresDocumentNavigation`

- **原因**：新前端是另一个应用，`routing.push` 会命中老控制台自己的 `*` 路由。
- **何时重新考虑**：如果两个 UI 将来合并成一个应用。

### DEC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-03：文案进已有的 locale 文件

- **原因**：locale 插件按文件与 en 对比，新文件会在没有翻译的语言里整块缺失。
- **何时重新考虑**：如果入口文案需要按租户定制。

## 系统现状

### 数据流

`view.js 下发 client.portal.newConsole → visibleProductEntries 决定顺序 → renderProductEntry 渲染 → 点击 location.assign('/kube-frontend/')`

### 关键模块职责

| 模块 / 文件 | 职责 | 不做什么 |
| --- | --- | --- |
| `console/src/utils/returnPath.js` | 入口顺序与可见性 | 不渲染 |
| `console/src/components/Layout/Header/index.jsx` | 渲染按钮与点击行为 | 不决定顺序 |
| `console/src/core/containers/Login/index.jsx` | 登录回跳的整页跳转判定 | 不渲染导航 |

## 仓库落点

| 层 | 仓库 | 路径 | 改动 |
| --- | --- | --- | --- |
| 文案 | `console` | `locales/*/l10n-appStore-list.js` | 新增 `NEW_CONSOLE` |
| 组件 | `console` | `src/components/Layout/Header/index.jsx` | 新增 `newConsole` 入口 |
| 工具 | `console` | `src/utils/returnPath.js` | 顺序与可见性 |
| 登录 | `console` | `src/core/containers/Login/index.jsx` | 加进整页跳转白名单 |
| 接口 | `kube-server` | — | 不改 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `client.portal.newConsole` | 服务端注入的 `globals` | 是否挂载新前端 | 老控制台前端 |
| `NEW_CONSOLE` | locale 键 | 入口文案 | 老控制台前端 |

## 不变量

- **INV-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01**：入口存在 ⟺ 前缀已挂载。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01** | 登录回跳的 `routing.push` 会把 `/kube-frontend/...` 当成自己的路由 | 登录成功后落到老控制台的 404 | `src/core/containers/Login/index.jsx:pathRequiresDocumentNavigation` |
| **GOT-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-02** | 部分语言的 locale 文件没有 `AGENT_WORKSHOP` 这一行 | 按那一行插入会漏掉 10 个语言 | `locales/*/l10n-appStore-list.js` |

## 测试与可观测

- **自动化**：`src/utils/returnPath.test.js`；`tests/ui/tests/kube-frontend/integration/test_TC_L3_KUBE_FRONTEND_INTEGRATION_ENTRY_01.py`。
- **手动验证**：登录后看顶部导航，量四个按钮的 `x`/`y`/`height`。
- **日志 / 指标**：无。

## 后续改进

`entries` 字典是硬编码的，入口多了会难以维护。迁移完成后老控制台的入口会整体收敛，届时不需要扩展。

## 验收用例

- L3：`TC-L3-KUBE-FRONTEND-INTEGRATION-ENTRY-01`
