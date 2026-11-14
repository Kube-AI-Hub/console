# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-05 集群列表按 host/成员筛选

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-list`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/cluster-list.md`

## 产品功能

集群列表用「集群类型」筛选区分 host 与成员集群。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-list.md`](../../../../prd/kube-frontend/cluster-management/cluster-list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_LIST-05** — 已知集群至少包含主集群，当在集群列表把「集群类型」筛选设为「主集群」，则只显示主集群行；设为「成员集群」则只显示成员集群行（主集群行不出现）；清除筛选后恢复全部行，且主集群仍排在列表前面。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-list.md`](../../../../design/kube-frontend/cluster-management/cluster-list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-list.md`](../../../../prd/kube-frontend/cluster-management/cluster-list.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 找到要进的集群 (Priority: P1)

作为 **平台管理员**，我希望 **在一个列表里看到所有集群**，以便 **直接点进要操作的那个，而不是先猜集群名拼地址**。

**Independent Test**：打开集群列表，核对行数与接口返回的集群对象数一致，且每行名称是指向 `/kube-frontend/clusters/<name>/overview` 的链接。

## 前置与配置

- 已登录且 multicluster 开启（列表不被单集群重定向吃掉）

## 测试步骤

1. 打开集群列表
2. 把「集群类型」筛选设为「主集群」
3. 设为成员
4. 清除筛选

## 期望结果

- 三次断言都以行 attribute 判定，无需写操作

## 失败排查

- 列表跳到单集群 overview：multicluster 未开启
- 筛选后仍显示全部：filter 未接到 rows 计算

## 产品改版后如何更新自动化

- 选择器：clusters:filter:type / data-ai-row
