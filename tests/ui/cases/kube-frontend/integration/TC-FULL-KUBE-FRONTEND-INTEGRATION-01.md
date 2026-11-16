# TC-FULL-KUBE-FRONTEND-INTEGRATION-01 新前端与老控制台同源并存

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-INTEGRATION-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `integration` `page`
- **入口**: `{BASE_URL}/kube-frontend/`
- **需求**: `prd/kube-frontend/integration/_index.md`

## 产品功能

两个 UI 共用一个地址：老控制台占裸 / 与 /login，新前端占 /kube-frontend；登录态互通，入口可关。

### 关联需求

- `prd/kube-frontend/integration/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/integration/_index.md`](../../../../prd/kube-frontend/integration/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-INTEGRATION-01** — Given 新前端已挂载在老控制台同一地址的 `/kube-frontend` 前缀下，When 依次访问 `/`、`/login`、`/kube-frontend/`、`/kube-frontend/login`，Then 前两个由老控制台响应、后两个由新前端响应，四者都返回 HTML。

### 关联设计

- 技术方案 [`design/kube-frontend/integration/_index.md`](../../../../design/kube-frontend/integration/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/integration/_index.md`](../../../../prd/kube-frontend/integration/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为平台用户，从老控制台一键进入新前端，不用重新登录


**Independent Test**：在老控制台登录后，点顶部「新版控制台」，落在 `/kube-frontend/` 的工作台且直接是已登录状态；不出现登录页。

### US2 - 作为平台用户，刷新或直接粘贴新前端的链接都能打开


**Independent Test**：在地址栏输入 `{地址}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps` 并回车，页面正常渲染列表，而不是老控制台的页面或 404。

### US3 - 作为运维，能够关闭新前端入口而不影响老控制台


**Independent Test**：把 `ks-console-config` 的 `newConsole.enabled` 置为 `false` 并重启 ks-console，顶部入口消失、`/kube-frontend/*` 返回 404，而老控制台所有页面照常工作。

## 前置与配置

- 已登录老控制台
- 新前端已挂载（ks-console 的 newConsole.enabled 为 true）

## 测试步骤

1. 依次请求 /、/login、/kube-frontend/、/kube-frontend/login，记录状态码与 Content-Type
2. 在老控制台顶部导航找到「新版控制台」并点击
3. 核对新前端工作台是否直接渲染（不出现登录表单）
4. 读 localStorage 的键集合与 document.cookie

## 期望结果

- 第一步四个路径都是 200 且 Content-Type 为 text/html
- 第三步落在 /kube-frontend/ 且工作台进入 ready，不出现登录页
- 第四步 localStorage 只有 kah_token 一个 token 键，cookie 含 kah_token
- 关掉 newConsole 后入口消失、/kube-frontend/* 返回 404，老控制台其余页面照常

## 失败排查

- /kube-frontend/* 返回老控制台的壳：检查 routes.js 的 mountPortal 是否在 catch-all 之前
- 进入新前端被要求登录：检查 localStorage 键名是否已统一为 kah_token
- 静态资源 404：检查 vite.config.ts 的 base 与反代是否剥了前缀

## 产品改版后如何更新自动化

- 前缀或入口文案变化时同步 tests/ui/pages/login.py 与 pages 下的导航断言
