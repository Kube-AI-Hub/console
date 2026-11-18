# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-06 容器组详情 · 资源请求与限制的聚合

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/detail.md`

## 产品功能

容器组概览的「资源请求」「资源限制」两行是全部容器（含 init 容器）的聚合，每个资源一项；完全没有资源声明时两行都是「-」。

### 关联需求

- `prd/kube-frontend/app-workloads/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL-06** — 已知容器组的容器分别声明了资源请求与限制，当打开容器组详情概览，则显示「资源请求」「资源限制」两行，值为该容器组全部容器（含 init 容器）的聚合，每个资源一项；完全没有资源声明时两行显示「-」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail.md`](../../../../design/kube-frontend/app-workloads/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail.md`](../../../../prd/kube-frontend/app-workloads/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认对象细节并就地操作 (Priority: P1)

作为 **项目运维**，我希望 **在详情里看到属性与镜像并直接操作**，以便 **不必来回列表**。

**Independent Test**：打开任一部署详情，核对六项属性与镜像列表。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建一个容器组：一个 init 容器 + 两个工作容器，各自声明不同的 requests/limits；再建一个不声明任何资源的容器组；用例结束后无条件删除

## 测试步骤

1. 打开带资源声明的容器组详情，等概览就绪
2. 读 pods-detail:requests 与 pods-detail:limits 的文本
3. 核对 cpu 与 memory 的合计等于三个容器（含 init）之和，每个资源一项
4. 打开没有资源声明的容器组详情，读同样两行

## 期望结果

- 资源请求行同时含 cpu 合计与 memory 合计，值等于 init 容器 + 两个工作容器之和（按基准单位相加后格式化）
- 资源限制行同理，且与请求行是两组不同的数字
- 没有资源声明时两行都显示「-」，不显示 0

## 失败排查

- 合计偏小：只遍历了 spec.containers，漏了 initContainers
- 值像 500m1：quantity 字符串直接相加，没有先进基准单位
- 空声明显示 0：把「没声明」当成了 0

## 产品改版后如何更新自动化

- 句柄见 WorkloadDetailPage.tsx 的 pods-detail:requests / pods-detail:limits；聚合见 api-client 的 podResourceLines
