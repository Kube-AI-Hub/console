# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02 集群级工作负载 · 七类分页与空态刷新

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-workloads`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/deployments`
- **需求**: `prd/kube-frontend/cluster-management/cluster-workloads.md`

## 产品功能

七类资源的每页档位与刷新均使用当前列表条件，空态仍可刷新。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-workloads.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-workloads.md`](../../../../prd/kube-frontend/cluster-management/cluster-workloads.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_WORKLOADS-02** — 七类列表均可切换 10/20/50/100 每页条数，默认 20；切换档位回到第一页并保留搜索、排序；刷新重新读取当前档位与条件，进行中有忙碌反馈，失败显示错误。翻页保留已有内容，但不同资源类型或集群之间不复用旧数据占位。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-workloads.md`](../../../../design/kube-frontend/cluster-management/cluster-workloads.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-workloads.md`](../../../../prd/kube-frontend/cluster-management/cluster-workloads.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 跨项目盘点工作负载 (Priority: P1)

作为 **集群管理员**，我希望 **在不知道项目的情况下按类型盘点工作负载**，以便 **先找到对象，再进到它所属的项目处理**。

**Independent Test**：打开集群级部署页，核对行数等于接口首页条数、项目列等于对象命名空间、名称链接含 workspace 与项目段。

## 前置与配置

- 已登录且有集群读取权限
- 用例只读，不创建或删除资源

## 测试步骤

1. 依次打开 deployments/statefulsets/daemonsets/jobs/cronjobs/services/ingresses
2. 将每页条数改为 10，核对真实请求 limit=10、page=1
3. 输入唯一的不存在的名称并等待空态
4. 点击刷新，等待包含当前搜索和档位的真实响应

## 期望结果

- 七类页面都发出包含新 limit 与 page 的列表请求
- 刷新请求保留搜索和档位，结束后为空态且输入不丢失

## 失败排查

- 个别类型缺控件：检查是否使用共用 ClusterWorkloadsPage
- 空态无法刷新：检查工具栏是否依赖 rows 长度

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py
