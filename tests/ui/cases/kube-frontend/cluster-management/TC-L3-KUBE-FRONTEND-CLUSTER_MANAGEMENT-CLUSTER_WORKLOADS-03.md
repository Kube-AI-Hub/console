# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03 集群级工作负载 · 按项目筛选与行操作（编辑信息 / 删除）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-workloads`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{CLUSTER}/deployments`
- **需求**: `prd/kube-frontend/cluster-management/cluster-workloads.md`

## 产品功能

集群级负载列表可按项目筛选；普通行提供编辑信息/编辑 YAML/删除，写按行所属项目寻址；联邦托管行无操作；批量删除按项目分组。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-workloads.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-workloads.md`](../../../../prd/kube-frontend/cluster-management/cluster-workloads.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-03** — 已知集群级工作负载列表里有一个普通部署与一个联邦托管的部署，当用「项目」筛选选择某个项目，则列表只显示该项目的对象且请求带该命名空间；清空筛选回到全部项目；打开普通行的更多操作提供「编辑信息 / 编辑 YAML / 删除」，联邦托管行不渲染操作；编辑信息保存后按**该行自己的项目**更新注解；勾选多行批量删除时按行所属项目分别发出删除请求，完成后列表刷新且选中清空。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-workloads.md`](../../../../design/kube-frontend/cluster-management/cluster-workloads.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-workloads.md`](../../../../prd/kube-frontend/cluster-management/cluster-workloads.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目盘点工作负载 (Priority: P1)

作为 **集群管理员**，我希望 **在不知道项目的情况下按类型盘点工作负载**，以便 **先找到对象，再进到它所属的项目处理**。

**Independent Test**：打开集群级部署页，核对行数等于接口首页条数、项目列等于对象命名空间、名称链接含 workspace 与项目段。

## 前置与配置

- 已登录，host 集群，admin
- 用例在 default 创建唯一命名的部署（1 副本、暂停拉取镜像以避免真实调度），结束后删除

## 测试步骤

1. 用 API 在 default 创建 Deployment tc-e2e-deploy-<stamp>
2. 打开 /kube-frontend/clusters/host/deployments
3. 用「项目」筛选选择 default，核对请求带上该命名空间且列表只剩该项目的行
4. 搜索该名称，打开行操作，核对三项（编辑信息 / 编辑 YAML / 删除）
5. 点「编辑信息」，修改描述并确认；用 API 回读 kubesphere.io/description
6. 清空项目筛选，核对回到全部项目
7. 再打开行操作点「删除」，输入名称确认；用列表确认对象消失

## 期望结果

- 项目筛选改变请求的 namespace 并回到第 1 页
- 行操作三项齐全，写按行所属项目寻址
- 联邦托管行不渲染操作
- 删除后对象从列表与 API 集合中消失

## 失败排查

- 筛选无效：namespace 没有进入 queryKey（切项目不会重新请求）
- 编辑 404：写到了没有 namespaces 段的路径

## 产品改版后如何更新自动化

- 行 data-ai-row=<name>；项目筛选句柄 cluster-deployments:filter:project
