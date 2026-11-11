# TC-L3-KUBE-FRONTEND-SECRETS-CREATE-01 保密字典 · 创建时的名称与项目校验

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-CREATE-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `create`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/create.md`

## 产品功能

名称格式、重名与项目必填在进入下一步前校验。

### 关联需求

- `prd/kube-frontend/secrets/create.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/create.md`](../../../../prd/kube-frontend/secrets/create.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-CREATE-01** — Given 创建弹窗已打开，When 名称留空、含大写、以连字符开头或超过 63 字符，Then 提示对应错误且不进入第二步；When 名称与同项目已有对象重复，Then 提示「名称已存在，请输入其他名称。」；When 选择另一个项目，Then 对象创建到所选项目。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/create.md`](../../../../design/kube-frontend/secrets/create.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/create.md`](../../../../prd/kube-frontend/secrets/create.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，从表单创建一条普通（Opaque）凭据


**Independent Test**：创建 → 名称 `app-secret` → 下一步 → 添加键 `password`、值任意 → 创建；列表出现 `app-secret`，详情一条键值。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间

## 测试步骤

1. 点击「创建」
2. 输入含大写的名称并点「下一步」
3. 输入已存在的名称并点「下一步」

## 期望结果

- 提示「名称无效」且停留在基本信息步
- 提示「名称已存在，请输入其他名称。」

## 失败排查

- 重名判断失败时确认 checkName 走的是 /api/v1 而不是列表接口

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
