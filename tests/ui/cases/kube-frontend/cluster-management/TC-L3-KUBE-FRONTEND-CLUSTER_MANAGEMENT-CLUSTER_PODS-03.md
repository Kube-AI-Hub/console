# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-03 集群级容器组 · 每页档位与分页重置

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-pods`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/pods`
- **需求**: `prd/kube-frontend/cluster-management/cluster-pods.md`

## 产品功能

从第二页切换每页档位，回到第一页并按新 limit 请求；刷新不重置档位。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-pods.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-pods.md`](../../../../prd/kube-frontend/cluster-management/cluster-pods.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_PODS-03** — 默认每页 20 条，可切换 10/20/50/100 条；从非首页切换档位时回到第一页，保留搜索和排序，请求携带新 limit；刷新保留该档位。翻页和搜索期间保留已有内容并标明忙碌，不以旧集群数据占位。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-pods.md`](../../../../design/kube-frontend/cluster-management/cluster-pods.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-pods.md`](../../../../prd/kube-frontend/cluster-management/cluster-pods.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群里此刻有哪些容器组 (Priority: P1)

作为 **集群管理员**，我希望 **跨项目查看容器组**，以便 **在不知道属于哪个项目时先找到它**。

**Independent Test**：打开集群级容器组页，核对行数等于接口首页条数，项目列等于对象所在命名空间，名称链接带正确 workspace 段。

## 前置与配置

- 已登录且有集群读取权限
- 集群容器组超过 20 条，测试只读不修改对象

## 测试步骤

1. 打开容器组列表，核对默认每页 20 条和四个可选档位
2. 进入第二页，再切换为每页 50 条
3. 等待真实列表响应并核对请求 limit 与 page、显示行数
4. 刷新并确认仍使用 limit=50 与 page=1

## 期望结果

- 档位为 10/20/50/100，默认 20
- 切换后的请求为 limit=50、page=1，行数等于响应 items 数
- 刷新请求保留档位，分页当前页为 1

## 失败排查

- 分页器变化但请求未变化：检查 pageSize 是否进入查询键与请求
- 保持第二页：检查共享列表状态是否同步重置页码

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py
