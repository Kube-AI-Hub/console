# TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01 服务账户 · 列表列与角色显示

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `serviceaccounts` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/serviceaccounts`
- **需求**: `prd/kube-frontend/serviceaccounts/list.md`

## 产品功能

列表显示名称、项目、角色、保密字典、创建时间；无角色时角色列为空。

### 关联需求

- `prd/kube-frontend/serviceaccounts/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/serviceaccounts/list.md`](../../../../prd/kube-frontend/serviceaccounts/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SERVICEACCOUNTS-LIST-01** — Given 项目内有多条 ServiceAccount，When 打开列表，Then 每行显示名称（别名替换名称，第二行为描述或 `-`）、角色、保密字典链接、创建时间；没有角色的行角色列为空。

### 关联设计

- 技术方案 [`design/kube-frontend/serviceaccounts/list.md`](../../../../design/kube-frontend/serviceaccounts/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/serviceaccounts/list.md`](../../../../prd/kube-frontend/serviceaccounts/list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，看到每个服务账户的角色与它挂载的令牌


**Independent Test**：打开列表，读出一条服务账户：角色列显示注解里的角色名，保密字典列显示令牌 Secret 名称。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 测试账户带角色注解，另一个账户不带

## 测试步骤

1. 打开列表
2. 核对表头
3. 读取两个测试账户的角色单元格

## 期望结果

- 表头依次为 名称、项目、角色、保密字典、创建时间
- 带角色的行显示角色名
- 无角色的行角色单元格为空

## 失败排查

- 角色列出现「无」说明映射层加了占位词

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
