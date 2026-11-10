# TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01 配置字典 · 详情属性与数据分区

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/detail.md`

## 产品功能

详情展示头部、四项属性与逐条键值，值保留换行。

### 关联需求

- `prd/kube-frontend/configmaps/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/detail.md`](../../../../prd/kube-frontend/configmaps/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-DETAIL-01** — Given 对象存在，When 打开详情，Then 头部显示名称、别名与描述，属性区显示集群、项目、创建时间（`YYYY-MM-DD HH:mm:ss`）、创建者，`数据` 分区逐条列出键值；键值中的换行按原样保留。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/detail.md`](../../../../design/kube-frontend/configmaps/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/detail.md`](../../../../prd/kube-frontend/configmaps/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 作为项目成员，查看某个配置字典的全部键值


**Independent Test**：从列表点击名称进入详情，逐个核对键名与值与 `kubectl get configmap <name> -o yaml` 一致。

## 前置与配置

- 已登录
- 项目 default 中至少存在一个配置字典

## 测试步骤

1. 打开 {BASE_URL}/.../configmaps 并点击某个对象名称
2. 观察头部、属性区与「数据」分区
3. 展开一个多行的值

## 期望结果

- 头部显示名称、别名与描述
- 属性区依次为集群、项目、创建时间、创建者，时间形如 2006-01-02 15:04:05
- 数据分区逐条列出键与值，多行值不被折叠

## 失败排查

- 先确认 BFF 返回的状态码与 code，再看页面状态属性

## 产品改版后如何更新自动化

- 文案变化时改 packages/locales/src/index.ts
