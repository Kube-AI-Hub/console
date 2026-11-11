# TC-L2-KUBE-FRONTEND-LOGIN-02 新前端 · 登录失败提示可区分

- **用例 ID**: `TC-L2-KUBE-FRONTEND-LOGIN-02`
- **级别**: L2  **套件**: `login`
- **模块**: `kube-frontend` / `login` `session`
- **入口**: `{BASE_URL}/login`
- **需求**: `prd/kube-frontend/login.md`

## 产品功能

登录失败时用户能看出是哪一类问题，而不是笼统的「登录失败」。

### 关联需求

- `prd/kube-frontend/login.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/login.md`](../../../../prd/kube-frontend/login.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L2-KUBE-FRONTEND-LOGIN-02** — Given 登录页，When 用户名或密码为空提交，Then 对应输入框下方给出提示，且不发起请求。
- **AC-L2-KUBE-FRONTEND-LOGIN-03** — Given 密码错误，When 提交，Then 表单内显示「用户名或密码不正确」，密码被清空，未写入 token。

### 关联设计

- 技术方案 [`design/kube-frontend/login.md`](../../../../design/kube-frontend/login.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/login.md`](../../../../prd/kube-frontend/login.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为输错密码的用户，知道错在哪里而不是「登录失败」


**Independent Test**：输入错误密码提交，表单内出现「用户名或密码不正确」，密码框被清空，用户名保留；集群不可达时提示的是连不上集群而不是密码错误。

## 前置与配置

- 浏览器 localStorage 中没有 kubesphere-token

## 测试步骤

1. 打开 /login，不填任何内容直接提交
2. 只填用户名，提交
3. 填入存在的用户名与错误密码，提交
4. 观察提示与输入框

## 期望结果

- 空提交时用户名与密码下方各出现一条提示，且不发生网络请求
- 只填用户名时只有密码下方出现提示
- 错误密码时表单内显示「用户名或密码不正确」
- 错误密码后密码框被清空，用户名保留，localStorage 中没有 token

## 失败排查

- 显示「登录失败」而没有任何细分提示时，检查 BFF 返回的 code 是否被 ApiError 折叠
- 提示为「无法连接集群」时先确认 ks-apiserver 可达

## 产品改版后如何更新自动化

- 文案变更时同步 locales 与断言
