# TC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01 同源集成 · 前缀挂载与静态分流

- **用例 ID**: `TC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `integration` `mount`
- **入口**: `{BASE_URL}/kube-frontend/`
- **需求**: `prd/kube-frontend/integration/mount.md`

## 产品功能

新前端挂在 /kube-frontend 前缀下，静态资源与客户端路由分别得到正确的响应。

### 关联需求

- `prd/kube-frontend/integration/mount.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/integration/mount.md`](../../../../prd/kube-frontend/integration/mount.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-INTEGRATION-MOUNT-01** — Given 新前端已挂载，When 请求 `/kube-frontend/assets/<hashed>.js`、`/kube-frontend/<客户端路由>`、`/kube-frontend/assets/<missing>.js`，Then 依次得到 200+`immutable`、SPA 外壳、404。

### 关联设计

- 技术方案 [`design/kube-frontend/integration/mount.md`](../../../../design/kube-frontend/integration/mount.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/integration/mount.md`](../../../../prd/kube-frontend/integration/mount.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为平台用户，直接粘贴新前端的深链接也能打开


**Independent Test**：在地址栏输入 `{地址}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps` 回车，看到配置字典列表（或空态），不是老控制台页面、不是 404。

## 前置与配置

- 新前端已挂载（ks-console 的 newConsole.enabled 为 true）

## 测试步骤

1. 请求 /kube-frontend/ 并从 HTML 里取出一个 /kube-frontend/assets/*.js 的地址
2. 请求该静态资源
3. 请求 /kube-frontend/system-workspace/clusters/host/projects/default/configmaps
4. 请求一个不存在的 /kube-frontend/assets/<missing>.js
5. 请求 /kube-frontend/foo 且 Accept 为 application/json

## 期望结果

- 静态资源返回 200，Content-Type 为 javascript，Cache-Control 含 immutable
- 客户端路由返回 200 且 Content-Type 为 text/html（SPA 外壳）
- 缺失的静态资源返回 404，不是 HTML
- Accept 为 application/json 的未知路径返回 404
- 裸 / 与 /login 仍返回老控制台的 HTML

## 失败排查

- 静态资源 404 但 Pod 里有文件：检查 STATIC_DIR 是否为绝对路径，相对路径会让容器检查失败
- 客户端路由返回老控制台的壳：检查 mountPortal 是否在 .all('{/*path}') 之前注册
- 缺失资源返回 HTML：检查 static.ts 是否按扩展名分流

## 产品改版后如何更新自动化

- 前缀常量变更时同步 server/libs/portalMounts.js 与 static.ts 的 APP_PREFIX
