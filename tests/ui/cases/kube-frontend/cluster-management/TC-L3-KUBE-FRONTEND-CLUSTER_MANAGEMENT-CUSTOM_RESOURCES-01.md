# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01 自定义资源 · 列表与作用域一致

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `custom-resources`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/custom-resources`
- **需求**: `prd/kube-frontend/cluster-management/custom-resources.md`

## 产品功能

自定义资源页列出集群全部 CRD，显示类型、组/存储版本、全名、作用域、是否已提供与创建时间；行数与接口一致。

### 关联需求

- `prd/kube-frontend/cluster-management/custom-resources.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/custom-resources.md`](../../../../prd/kube-frontend/cluster-management/custom-resources.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CUSTOM_RESOURCES-01** — 已知集群注册了若干 CRD，当打开自定义资源页，则列出全部 CRD；每行显示类型、`组/存储版本`、全名、作用域（集群级/命名空间级）、是否已提供与创建时间；行数与 `customresourcedefinitions` 接口返回一致；按类型排序时首列为类型。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/custom-resources.md`](../../../../design/kube-frontend/cluster-management/custom-resources.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/custom-resources.md`](../../../../prd/kube-frontend/cluster-management/custom-resources.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认某个 CRD 是否已注册 (Priority: P1)

作为 **集群管理员或开发**，我希望 **按类型或全名搜到某个 CRD**，以便 **在写 manifest 之前确认这个资源可用，而不是提交后才被拒**。

**Independent Test**：搜索一个已知 kind，核对首行就是它，且副行显示 `组/版本`。

### US2 - 区分集群级与命名空间级 (Priority: P1)

作为 **开发**，我希望 **看到每个 CRD 的作用域**，以便 **知道 manifest 里要不要写 `metadata.namespace`**。

**Independent Test**：核对每一行的作用域只可能是「集群级」或「命名空间级」，且与接口 `spec.scope` 一致。

### US3 - 看出哪些 CRD 已停用 (Priority: P2)

作为 **集群管理员**，我希望 **看到 CRD 是否仍被提供**，以便 **解释「资源已注册但创建被拒」的现象**。

**Independent Test**：核对「已提供」徽标与接口 `spec.versions[].served` 一致。

## 前置与配置

- 已登录，且对集群 host 有读取权限
- 集群注册了至少一个 CRD

## 测试步骤

1. 用 API 读取 customresourcedefinitions（limit=-1），记下总数与其中一个 CRD 的 kind、scope、served
2. 打开自定义资源页，等待 surface 就绪
3. 核对行数与接口一致
4. 搜索某个 kind，核对首行即该 CRD
5. 核对首行的作用域文案与接口 spec.scope 一致

## 期望结果

- 页面状态 ready，行数与接口返回的 CRD 数一致（少行说明漏了 limit=-1）
- 表头包含 类型、名称、作用域、已提供、创建时间
- 搜索 kind 后首行是它，且副行显示 组/版本
- 作用域为「集群级」或「命名空间级」，与接口一致

## 失败排查

- 全部显示「未提供」：served 读错了层级（应是 spec.versions[].served）
- 行数少于接口：请求没带 limit=-1
- 搜索无结果：搜索应同时匹配 kind 与全名
- 排序无效：apiextensions 没有服务端排序，必须本地排

## 产品改版后如何更新自动化

- 列或标识变化时改 pages/cluster_management.py 与 CustomResourcesPage.tsx
