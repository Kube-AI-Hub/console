# TC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01 同源集成 · 登录态互通

- **用例 ID**: `TC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `integration` `session`
- **入口**: `{BASE_URL}/kube-frontend/`
- **需求**: `prd/kube-frontend/integration/session.md`

## 产品功能

两个 UI 共用一个 kah_token：老控制台登录后进入新前端不再登录，退出两边都失效。

### 关联需求

- `prd/kube-frontend/integration/session.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/integration/session.md`](../../../../prd/kube-frontend/integration/session.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-INTEGRATION-SESSION-01** — Given 已登录老控制台，When 打开 `/kube-frontend/`，Then 不出现登录页，`localStorage` 里只有 `kah_token` 一个 token 键，`document.cookie` 含 `kah_token`。

### 关联设计

- 技术方案 [`design/kube-frontend/integration/session.md`](../../../../design/kube-frontend/integration/session.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/integration/session.md`](../../../../prd/kube-frontend/integration/session.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为平台用户，进新前端不用再登录一次


**Independent Test**：在老控制台登录，点「新版控制台」，新前端直接显示工作台（有账号菜单），不出现登录表单。

## 前置与配置

- 已登录老控制台
- 新前端已挂载

## 测试步骤

1. 在老控制台登录后，读取 localStorage 的全部键名与 document.cookie
2. 打开 /kube-frontend/
3. 核对是否出现登录表单
4. 在新前端右上角账号菜单退出登录
5. 回到老控制台页面刷新

## 期望结果

- localStorage 中 token 键只有 kah_token，没有 kubesphere-token
- document.cookie 含 kah_token
- 第二步不出现登录表单，工作台直接进入 ready
- 退出后地址为 /kube-frontend/login，localStorage 中没有 kah_token
- 第五步老控制台也回到登录页

## 失败排查

- 进入新前端被要求登录：检查 api.ts 的 TOKEN_KEY 是否与老控制台一致
- 老控制台仍登录：检查退出是否清了 kah_token 与 cookie
- cookie 缺失：检查 AuthProvider 是否在写 token 时同步写 cookie

## 产品改版后如何更新自动化

- token 键名变化时同步 tests/ui/pages/*.py 与 conftest 的 storage_state
