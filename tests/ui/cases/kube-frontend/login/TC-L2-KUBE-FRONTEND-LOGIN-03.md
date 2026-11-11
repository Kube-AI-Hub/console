# TC-L2-KUBE-FRONTEND-LOGIN-03 新前端 · 退出登录后 token 失效

- **用例 ID**: `TC-L2-KUBE-FRONTEND-LOGIN-03`
- **级别**: L2  **套件**: `login`
- **模块**: `kube-frontend` / `login` `session`
- **入口**: `{BASE_URL}/`
- **需求**: `prd/kube-frontend/login.md`

## 产品功能

退出登录不仅清掉浏览器里的 token，集群侧也一并注销。

### 关联需求

- `prd/kube-frontend/login.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/login.md`](../../../../prd/kube-frontend/login.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L2-KUBE-FRONTEND-LOGIN-04** — Given 已登录，When 点击账号菜单的「退出登录」，Then 回到登录页，token 从 `localStorage` 移除，且 upstream 收到 token 注销。
- **AC-L2-KUBE-FRONTEND-LOGIN-05** — Given `localStorage` 里有一个已被集群注销的 token，When 打开任意页面，Then 不渲染控制台外壳，直接回到登录页。

### 关联设计

- 技术方案 [`design/kube-frontend/login.md`](../../../../design/kube-frontend/login.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/login.md`](../../../../prd/kube-frontend/login.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 作为离开的用户，退出后 token 在集群侧也失效


**Independent Test**：点击右上角账号菜单的「退出登录」，回到登录页；用退出前的 token 直接请求 kapis 返回 401。

## 前置与配置

- 已登录并停留在任意控制台页面

## 测试步骤

1. 记录当前 token
2. 打开右上角账号菜单，点击「退出登录」
3. 用记录的 token 直接请求 kapis 的 configmaps 资源
4. 把记录的 token 写回 localStorage 后刷新页面

## 期望结果

- 退出后地址为 /login，localStorage 中没有 kubesphere-token
- 第三步返回 401
- 第四步不渲染控制台外壳，回到 /login

## 失败排查

- 第三步仍为 200 时检查登出是否真的调用了 GET /oauth/logout
- 第四步闪出控制台再跳走，说明闸门放在了 effect 里而不是渲染前

## 产品改版后如何更新自动化

- 账号菜单的 data-ai-id 变更时同步断言
