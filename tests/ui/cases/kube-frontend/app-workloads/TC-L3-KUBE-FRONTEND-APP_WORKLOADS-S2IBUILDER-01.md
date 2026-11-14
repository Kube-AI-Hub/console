# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01 镜像构建器 · 项目级只读列表与空态

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

项目级镜像构建器页从 devops v1alpha1 命名空间端点读取 S2iBuilder：无实例时显示空态并说明来源；有实例时每行显示名称/基础镜像/最近构建状态/创建时间；请求失败显示错误面板与重试；页面不提供写入口。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01** — 已知在 host 集群的某个项目，当打开 /kube-frontend/<workspace>/clusters/host/projects/<namespace>/s2ibuilder，则页面通过 /apis/devops.kubesphere.io/v1alpha1/namespaces/<namespace>/s2ibuilders 读取构建器：没有构建器（当前默认项目为 0）时显示「暂无镜像构建器」空态并说明构建器由 S2I/B2I 构建流程创建、本页只读；有构建器时每行显示名称（displayName 或 name）、基础镜像（spec.config.builderImage）、最近构建状态（status.lastRunState：Running→构建中、Successful→构建成功、Failed→构建失败、空→尚未构建）与创建时间，行数等于接口 items 数；接口 404/5xx 时显示错误面板与重试，而不是空白页；页面不提供创建、编辑、删除或重新构建入口。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看到项目里有哪些镜像构建器、它们最近构建得怎么样 (Priority: P1)

作为 **项目运维**，我希望 **在项目里看到已有的镜像构建器及其基础镜像和最近一次构建状态**，以便 **判断某个服务的镜像是否构建成功、是否还在构建中，而不必逐个去看 s2irun**。

**Independent Test**：打开项目的镜像构建器页，页面状态与 API 列表一致：没有构建器时显示空态并说明来源；有构建器时每行显示名称、基础镜像、状态与创建时间；接口失败时显示错误面板与重试。

## 前置与配置

- 已登录，且在 host 集群的 default 项目
- devops 模块已安装，v1alpha1 的 s2ibuilders CRD 可读（当前项目 0 条）

## 测试步骤

1. 用 API 读取 /apis/devops.kubesphere.io/v1alpha1/namespaces/default/s2ibuilders 的 items 数
2. 打开 /kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder
3. 等待页面状态离开 loading，核对状态与 items 数一致（0 → empty，>0 → ready）
4. 若为空：核对空态文案说明构建器由 S2I/B2I 流程创建、本页只读
5. 若有数据：核对表头含 名称/基础镜像/状态/创建时间，行数等于 items
6. 收集页面产生的写请求与 v1alpha3 s2ibuilders 请求，断言为空

## 期望结果

- 页面读取 v1alpha1 命名空间端点，不请求 v1alpha3
- 0 条时显示「暂无镜像构建器」空态并解释来源，不显示错误面板
- >0 时行数等于 items 数且四列存在
- 页面无创建/编辑/删除入口，无 POST/PUT/PATCH/DELETE

## 失败排查

- 页面显示错误：是否请求了 v1alpha3（404），或项目/集群参数不对
- 空态看起来像故障：检查空态文案是否说明构建器来源与只读现状
- 状态与 API 不符：检查 v1alpha1 列表信封 items

## 产品改版后如何更新自动化

- 页面句柄变化时同步本用例
