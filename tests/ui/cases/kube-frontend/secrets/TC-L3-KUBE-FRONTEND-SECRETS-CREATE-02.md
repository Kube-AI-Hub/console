# TC-L3-KUBE-FRONTEND-SECRETS-CREATE-02 保密字典 · 用户名密码类型的必填与编码

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/create.md`

## 产品功能

basic-auth 必须填用户名与密码，含中文的值按 UTF-8 保存。

### 关联需求

- `prd/kube-frontend/secrets/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/create.md`](../../../../prd/kube-frontend/secrets/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-CREATE-02** — Given 进入数据设置并选类型「用户名和密码」，When 用户名或密码为空，Then 提交被拒绝并提示必填；When 两项都填，Then 提交后弹窗关闭、列表出现该对象，且其 `data.username`、`data.password` 解码后与输入一致（含中文与特殊字符）。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/create.md`](../../../../design/kube-frontend/secrets/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/create.md`](../../../../prd/kube-frontend/secrets/create.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，创建一条 TLS 证书


**Independent Test**：创建 → 名称 → 下一步 → 类型选「TLS 信息」→ 填证书与私钥 → 创建；`kubectl get secret -o json` 的 `data` 恰有 `tls.crt`、`tls.key`。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 创建 → 名称 → 下一步 → 类型选「用户名和密码」
2. 只填用户名后提交
3. 补齐密码（含中文与特殊字符）后提交
4. 用 kubectl 读取对象

## 期望结果

- 提交被拒绝并提示必填
- 提交成功后弹窗关闭、列表出现该对象
- data.username 与 data.password 解码后与输入逐字相同

## 失败排查

- 值不一致时检查 safeBtoa 是否对非 ASCII 做了 UTF-8 编码

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
