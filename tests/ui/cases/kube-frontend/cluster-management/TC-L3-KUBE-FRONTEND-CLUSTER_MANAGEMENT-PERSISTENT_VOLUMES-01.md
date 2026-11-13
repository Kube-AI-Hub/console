# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01 持久卷 · 七列与绑定声明

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `persistent-volumes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/persistentvolumes`
- **需求**: `prd/kube-frontend/cluster-management/persistent-volumes.md`

## 产品功能

持久卷列表显示七列；已绑定卷的绑定声明为 <命名空间>/<声明名>；行数与核心 API 一致。

### 关联需求

- `prd/kube-frontend/cluster-management/persistent-volumes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/persistent-volumes.md`](../../../../prd/kube-frontend/cluster-management/persistent-volumes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-PERSISTENT_VOLUMES-01** — 已知集群存在持久卷，当打开持久卷页，则显示名称、状态、容量、访问模式、绑定声明、回收策略、创建时间七列；已绑定的卷其「绑定声明」形如 `<命名空间>/<声明名>`，未绑定的显示 `-`；行数等于核心 API 返回的数量。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/persistent-volumes.md`](../../../../design/kube-frontend/cluster-management/persistent-volumes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/persistent-volumes.md`](../../../../prd/kube-frontend/cluster-management/persistent-volumes.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 判断一个持久卷被谁占用、释放后会怎样 (Priority: P1)

作为 **集群管理员**，我希望 **看到绑定声明与回收策略**，以便 **判断删除声明后数据会不会被一起删掉**。

**Independent Test**：打开持久卷页，核对某卷的绑定声明与回收策略同 `kubectl get pv` 一致。

## 前置与配置

- 已登录，且有集群权限
- 集群存在持久卷

## 测试步骤

1. 用核心 API 读取持久卷数量
2. 打开持久卷页，核对表头与行数
3. 核对已绑定卷的绑定声明格式

## 期望结果

- 表头依次为 名称、状态、容量、访问模式、绑定声明、回收策略、创建时间
- 行数等于 API 返回数量
- 已绑定卷的绑定声明含斜杠，未绑定的为 -

## 失败排查

- 行数不符时确认没有分页（本页一次取全量）
- 绑定声明只有名字说明未拼命名空间

## 产品改版后如何更新自动化

- 列变化时改 pages/cluster_management.py
