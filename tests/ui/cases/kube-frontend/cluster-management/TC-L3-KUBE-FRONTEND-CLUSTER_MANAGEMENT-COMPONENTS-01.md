# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01 系统组件 · 三列与不健康优先

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `components`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/components`
- **需求**: `prd/kube-frontend/cluster-management/components.md`

## 产品功能

系统组件列表显示三列；健康后端为 健康/总数；不健康的排在健康的前面。

### 关联需求

- `prd/kube-frontend/cluster-management/components.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/components.md`](../../../../prd/kube-frontend/cluster-management/components.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-COMPONENTS-01** — 已知平台有多个组件，当打开系统组件页，则显示名称、健康后端、启动时间三列；健康后端显示为 `健康/总数`，无后端的组件显示「无后端」；不健康的组件排在健康的组件之前。概览 type 分类链接按六类 namespace 过滤，组件分类可清除；读取和详情缓存含当前 cluster，成员集群不回退 host。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/components.md`](../../../../design/kube-frontend/cluster-management/components.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/components.md`](../../../../prd/kube-frontend/cluster-management/components.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 一眼看出哪个组件不正常 (Priority: P1)

作为 **集群管理员**，我希望 **异常组件排在列表最前**，以便 **不必在几十个组件里逐个对照数字**。

**Independent Test**：打开系统组件页，核对首行是健康数不等于总数的组件。

## 前置与配置

- 已登录，且有集群权限
- 平台有组件数据

## 测试步骤

1. 用 API 读取组件数量
2. 打开系统组件页，核对表头与行数
3. 读取第一行的健康列
4. 选择监控分类再清除，核对 namespace 过滤及全部组件恢复

## 期望结果

- 表头依次为 名称、健康后端、启动时间
- 行数与 API 一致
- 若存在不健康组件，第一行是不健康的那一个
- 分类不改变集群范围，清除恢复全量

## 失败排查

- 列表为空说明裸数组响应没有被正确解析
- 顺序不对时看排序谓词是否以 up 升序

## 产品改版后如何更新自动化

- 列变化时改 pages/cluster_management.py
