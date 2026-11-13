# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01 项目 · 列表四列与企业空间

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `projects`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/namespaces`
- **需求**: `prd/kube-frontend/cluster-management/projects.md`

## 产品功能

['项', '目', '列', '表', '显', '示', '名', '称', '、', '状', '态', '、', '企', '业', '空', '间', '、', '创', '建', '时', '间', '。']

### 关联需求

- `prd/kube-frontend/cluster-management/projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/projects.md`](../../../../prd/kube-frontend/cluster-management/projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PROJECTS-01** — 已知集群内至少有一个项目，当打开项目页，则显示名称、状态、企业空间、创建时间四列。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/projects.md`](../../../../design/kube-frontend/cluster-management/projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/projects.md`](../../../../prd/kube-frontend/cluster-management/projects.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看到集群里有哪些项目 (Priority: P1)

作为 **集群管理员**，我希望 **一次看到所有项目及其所属企业空间**，以便 **确认归属关系**。

**Independent Test**：打开项目页，核对名称集合与 `kubectl get ns` 一致。

## 前置与配置

- 已登录，且有集群权限
- 集群内至少有一个项目

## 测试步骤

1. 打开项目页
2. 核对表头
3. 核对第一行的企业空间与 API 的 kubesphere.io/workspace 标签一致

## 期望结果

- 表头依次为 名称、状态、企业空间、创建时间
- 企业空间等于标签值
- 状态为 Active 或 Terminating

## 失败排查

- 企业空间为空说明读错了标签位置
- 首屏慢时确认页面处于 loading 而不是空白

## 产品改版后如何更新自动化

- 项目列变化时改 pages/cluster_management.py
