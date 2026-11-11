# 集群配置字典详情 · 技术方案（L3）

> 承接 [`prd/kube-frontend/cluster-configmaps/detail.md`](../../../prd/kube-frontend/cluster-configmaps/detail.md)。

## 概述

详情页的路由参数、定位方式与只读分支。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01`

## 设计目标与非目标

**目标**：在集群管理区域内完成查看与编辑，不跳回项目级。

**非目标**：不合并进项目级详情页。

## 关键约束

- 定位键是 `(namespace, name)`；`namespace` 来自查询串。
- 联邦对象只读。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01 — 详情留在集群级，项目走查询串

**为什么**：老 console 把集群列表的名称链到项目级详情，读者点了之后顶栏从「平台管理」跳到「工作台」。名称只在项目内唯一，所以 URL 必须带上项目；用查询串而不是路径段，是因为详情页的路径形状与项目级保持一致（`clusters/:c/configmaps/:name`），项目在这里是定位参数而不是层级。

**被否方案**：照搬老 console。代价是任务被打断，收益只是少一个组件。

### DEC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-02 — 缺少 namespace 时明确报「未找到」

**为什么**：没有 `namespace` 就无法确定对象，猜测会打开同名的另一个项目的对象——比报错更糟。

**被否方案**：回退到「全部项目」里第一个同名对象。等于随机选一个让用户编辑。

## 系统现状

项目级详情页的结构（属性区 + `Data` 分区 + 顶部操作）直接复用，差异是操作区在联邦对象时换成说明。

## 仓库落点

- `apps/console-next/src/routes/kube-frontend.clusters.$cluster.configmaps.$name.tsx`

## 对外契约

- 读：`GET .../clusters/:c/namespaces/:ns/configmaps/:name`

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01** — 详情页的所有写操作都指向 URL 里的 namespace。

## 已知坑

- **GOT-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-02** — TanStack Router 会剥离未声明的查询参数，所以 `namespace` 必须在 `validateSearch` 里声明，否则链接带过去也会丢。

## 测试与可观测

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01`：两条同名对象分别打开，属性区项目不同。

## 后续改进

- 若产品要求「集群管理只浏览」，删掉本页并把名称链回项目详情。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_CONFIGMAPS-DETAIL-01`
