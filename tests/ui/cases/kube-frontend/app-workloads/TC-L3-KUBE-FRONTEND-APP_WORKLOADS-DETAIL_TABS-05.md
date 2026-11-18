# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05 容器组详情 · 环境变量页签（valueFrom 解析与掩码）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `detail-tabs`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/pods`
- **需求**: `prd/kube-frontend/app-workloads/detail-tabs.md`

## 产品功能

环境变量页签按容器分卡片（init 在前、首个展开），列出变量名与值；valueFrom 引用 ConfigMap / Secret 时显示被引用键的实际值（Secret 解码后）；名称含 password/secret 的值显示 ******；没有环境变量时显示「没有环境变量。」。

### 关联需求

- `prd/kube-frontend/app-workloads/detail-tabs.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-DETAIL_TABS-05** — 已知容器组声明了环境变量，当打开「环境变量」页签，则按容器分卡片（init 容器在前、首个默认展开），每张卡片列出变量名与值；valueFrom 引用 ConfigMap 或 Secret 的显示被引用键的实际值（Secret 解码后）；变量名含 password 或 secret 的值显示「******」；没有环境变量时显示「没有环境变量。」。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/detail-tabs.md`](../../../../design/kube-frontend/app-workloads/detail-tabs.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/detail-tabs.md`](../../../../prd/kube-frontend/app-workloads/detail-tabs.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 按页签查看详情且切换不重新加载 (Priority: P1)

作为 **项目运维**，我希望 **详情页把概览、关联容器组、修订版本、事件和元数据分到页签里，并默认停在概览**，以便 **不必在一条长页里滚动，切换页签时也不用等数据重新请求**。

**Independent Test**：打开一个部署详情，核对五个页签并逐个切换；再打开一个容器组详情，核对四个页签并从「容器」进入容器详情。

## 前置与配置

- 已登录，且在 host 集群（mlu370）的 default 项目空间
- 由用例创建一个 ConfigMap 与一个 Secret（值已知），再创建一个容器组：init 容器带字面量变量、工作容器带字面量 / ConfigMap 引用 / Secret 引用 / 名称含 password 的变量 / 指向不存在 ConfigMap 的引用；另建一个没有任何环境变量的容器组；用例结束后无条件删除

## 测试步骤

1. 打开带变量的容器组详情，点「环境变量」页签
2. 读卡片顺序与首张卡片的展开状态
3. 展开第二张卡片，逐行读变量名与值
4. 与用例写入的 ConfigMap / Secret 值逐项核对（Secret 需 base64 解码后比对）
5. 打开没有环境变量的容器组 → 环境变量页签

## 期望结果

- 卡片按容器分组，init 容器在前；首张卡片默认展开，其余收起
- 字面量变量显示写入的值；ConfigMap 引用显示被引用键的值；Secret 引用显示解码后的明文
- 名称含 password 的变量值显示 ******（不显示明文）
- 指向不存在对象的引用显示引用来源（含读取失败），不显示空串
- 没有环境变量时显示「没有环境变量。」（容器本身没有变量时这句在该容器卡片内，整块没有可显示内容时用空态）

## 失败排查

- 值显示空：valueFrom 只读了 value 字段；引用对象读取失败被当成空值
- Secret 显示一串 base64：没做 base64 解码
- 密码明文出现：掩码只按值判断，规则是「变量名含 password/secret」

## 产品改版后如何更新自动化

- 句柄 pods-detail:env:<容器名>、卡片内 [data-ai-row=<变量名>]、pods-detail:env-empty；解析见 api-client 的 resolvePodEnv
