# TC-L2-KUBE-FRONTEND-LOGIN-01 新前端 · 未登录访问深链接后登录回跳

- **用例 ID**: `TC-L2-KUBE-FRONTEND-LOGIN-01`
- **级别**: L2  **套件**: `login`
- **模块**: `kube-frontend` / `login` `session`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/login.md`

## 产品功能

未登录的用户访问受保护页面时被带到登录页，登录后回到原来要去的页面。

### 关联需求

- `prd/kube-frontend/login.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/login.md`](../../../../prd/kube-frontend/login.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L2-KUBE-FRONTEND-LOGIN-01** — Given 未登录，When 访问任意受保护路由，Then 跳转到 `/login` 且 `redirect` 携带原路径与查询串；登录成功后跳回该路径。
- **AC-L2-KUBE-FRONTEND-LOGIN-06** — Given 已登录，When 访问 `/login?redirect=//evil.com`，Then 不跳往站外，落在站内入口。

### 关联设计

- 技术方案 [`design/kube-frontend/login.md`](../../../../design/kube-frontend/login.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/login.md`](../../../../prd/kube-frontend/login.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为平台用户，用自己的账号登录后回到原来要去的页面


**Independent Test**：未登录状态下打开配置字典深链接，被带到 `/login?redirect=...`；输入正确账号密码后，落在原来的配置字典页而不是首页。

## 前置与配置

- 浏览器 localStorage 中没有 kubesphere-token
- 有一个可用的账号

## 测试步骤

1. 清空 localStorage 后打开配置字典深链接
2. 记录地址栏的路径与查询串
3. 输入账号与密码并提交
4. 观察地址栏与页面内容

## 期望结果

- 第二步被重定向到 /login，且 redirect 参数等于第一步的路径与查询串
- 提交后落在第一步的配置字典页，而不是首页
- 列表面板进入 ready 或 empty 状态

## 失败排查

- 停在 /login 时看表单内的错误提示，区分密码错误与连不上集群
- redirect 丢失时检查 __root 的 beforeLoad 是否仍在传 search

## 产品改版后如何更新自动化

- 登录页字段 id 变更时同步 pages 下的登录页对象
