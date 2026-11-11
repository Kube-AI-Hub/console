# TC-L3-KUBE-FRONTEND-SECRETS-EDIT-01 保密字典 · 编辑信息只改注解

- **用例 ID**: `TC-L3-KUBE-FRONTEND-SECRETS-EDIT-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `secrets` `edit`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/secrets`
- **需求**: `prd/kube-frontend/secrets/edit.md`

## 产品功能

编辑信息可改别名与描述，其余注解与 data 不变。

### 关联需求

- `prd/kube-frontend/secrets/edit.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/secrets/edit.md`](../../../../prd/kube-frontend/secrets/edit.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-SECRETS-EDIT-01** — Given 一条 Secret，When 打开「编辑信息」，Then 名称只读、别名与描述可改，且保存后对象上其他注解（创建者、kubesphere 标记、`is-default-class`）保持不变。

### 关联设计

- 技术方案 [`design/kube-frontend/secrets/edit.md`](../../../../design/kube-frontend/secrets/edit.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/secrets/edit.md`](../../../../prd/kube-frontend/secrets/edit.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，改描述而不碰数据


**Independent Test**：对某条 Secret 打开「编辑信息」，改描述并确认；列表与详情的描述更新，`data` 不变。

## 前置与配置

- 由用例的 fixture 创建一个前缀为 tc-e2e- 的测试对象，用例结束后无条件删除
- 已登录，且在 host 集群的 default 项目空间
- 存在一条带 kubesphere.io/creator 注解的对象

## 测试步骤

1. 行操作「编辑信息」
2. 修改别名与描述并确认
3. 读取对象的注解与 data

## 期望结果

- 名称输入框禁用
- 别名与描述更新
- creator 等其余注解不变，data 不变

## 失败排查

- 注解丢失时确认 EditInfoDialog 是否合并了原注解

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
