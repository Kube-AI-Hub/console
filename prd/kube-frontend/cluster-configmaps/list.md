# 集群配置字典列表（L3）

## 概述

集群管理下配置字典页的主表格：列、排序、分页、项目筛选。

## 用户故事

### US1 - 作为集群运维，一次看清集群里所有项目的配置

**Independent Test**：进入列表，默认按创建时间倒序，行来自不同项目；「项目」列显示每个对象所属项目；点击「名称」列头切换为按名称排序。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01** — Given 集群内有来自多个项目的 ConfigMap，When 打开列表，Then 表头依次为 名称 / 项目 / 字段 / 创建时间；默认按创建时间倒序；每行「项目」列显示对象所属项目，名称列第二行显示描述或 `-`。

- **AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02** — Given 列表处于「全部项目」，When 在项目筛选器中选择某个项目，Then 请求切换到该项目的命名空间并回到第 1 页，列表只剩该项目的对象；When 再次选择「全部项目」，Then 恢复跨项目结果。

## 设计目标

- 列定义是数据：集群级与项目级各自持有列数组，共享状态机与弹窗。
- 「项目」列承担去歧义：ConfigMap 名称只在项目内唯一，同名对象靠这一列区分。

## 约束与边界

- 跨项目读取走不带作用域段的集合端点；该端点由服务端遍历全部项目，比单项目查询慢，所以筛选默认值仍是「全部项目」但一步可收窄。
- 分页大小固定 10，与项目级一致。
- 「字段」列截断到 50 个字符并以 `...` 结尾，完整键名在悬停提示与详情页。

## UI 交互设计

- 「项目」列**不**在小屏隐藏：隐藏后同名对象无法区分。
- 「字段」列在 `md` 以下隐藏，「创建时间」在 `lg` 以下隐藏，与项目级一致。

## 文案与校验

- 标题与说明使用 `clusterConfigmaps.title` / `clusterConfigmaps.description`，与项目级区分。
- 筛选器「全部项目」使用 `clusterConfigmaps.filter.allProjects`。

## 边界情况

- 集群内没有任何 ConfigMap：显示空态，说明在任一项目中创建后会出现在这里。
- 集群内有数千条：分页由服务端切片，首次加载显示骨架。

## 功能需求

- FR-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01：跨项目列出 ConfigMap，含项目列。
- FR-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02：项目筛选可在「全部项目」与单个项目之间切换。

## 成功标准

- SC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01：`kubectl get configmap -A` 的条目数与列表总数一致。

## 明确不做

- 不做按项目多选的筛选：kapis 没有「按多个命名空间过滤」的参数。
- 不做列显示/隐藏的自定义。

## 假设

- 服务端返回的 `totalItems` 反映全集，与项目级一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-01`
- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-LIST-02`
