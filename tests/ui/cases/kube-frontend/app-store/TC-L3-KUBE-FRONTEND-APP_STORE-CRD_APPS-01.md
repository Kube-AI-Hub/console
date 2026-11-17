# TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01 项目内自制 CRD 应用列表（聚合健康与组件）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `crd-apps`
- **入口**: `{BASE_URL}/kube-frontend/{KA_WORKSPACE}/clusters/{KA_CLUSTER}/projects/{namespace}/applications/composing`
- **需求**: `prd/kube-frontend/app-store/crd-apps.md`

## 产品功能

项目「自制应用」列表：读取 Application（app.k8s.io）集合，按 selector 聚合 Deployment/StatefulSet/Service/Ingress，显示名称、健康（含就绪比）、组件数、版本、创建时间；与 Helm 已安装应用分开。

### 关联需求

- `prd/kube-frontend/app-store/crd-apps.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-01** — 已知项目 namespace 下有 N 个 Application（N 可能为 0），当打开 /kube-frontend/<ws>/clusters/<cluster>/projects/<ns>/applications/composing，则列出 N 行，每行显示名称、健康徽标（含就绪比，如 1/2）、组件数（工作负载/服务/路由）、版本（Application 的 app.kubernetes.io/version 标签）、创建时间；组件由 Application spec.selector.matchLabels 匹配同 namespace 的 Deployment/StatefulSet/Service/Ingress 计算，健康由匹配工作负载的 readyReplicas/replicas 计算（无工作负载=未知，全部就绪=健康，部分=更新中，0=异常）；N=0 时显示空态标题与说明；接口失败显示错误面板与重试；页面只读，无创建/编辑/删除入口。
- **AC-L3-KUBE-FRONTEND-APP_STORE-CRD_APPS-02** — 已知点击列表中的自制应用名称，当进入 /applications/composing/<name>，则显示该 Application 的基本信息（名称、namespace、健康徽标+就绪比、版本、创建时间）、selector，以及由 selector 匹配出的工作负载（Kind、就绪/期望）、服务（类型、ClusterIP）、路由（hosts）列表；与列表同源匹配规则，组件缺失时给出明确空说明；返回链接回到列表；页面只读。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/crd-apps.md`](../../../../design/kube-frontend/app-store/crd-apps.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/crd-apps.md`](../../../../prd/kube-frontend/app-store/crd-apps.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清项目里有哪些自制应用以及是否健康 (Priority: P2)

作为 **项目使用者**，我希望 **在项目控制台看到 Application 聚合出的应用、健康与组件数**，以便 **判断自制应用是否正常，而不是逐个翻工作负载**。

**Independent Test**：项目里创建一个 Application（selector=app:v1）与一个同标签 Deployment，打开 /applications/composing，行出现且组件工作负载数为 1、健康显示就绪比；无 Application 时显示空态。

## 前置与配置

- 已登录 admin；项目 namespace 可用；用例自建唯一 Application + 带 selector 标签的 Deployment，结束后删除两者

## 测试步骤

1. 在 namespace 创建 Application（selector app.kubernetes.io/version=v1）与同标签 Deployment（replicas=1）
2. 打开 /<ws>/clusters/<c>/projects/<ns>/applications/composing，等待列表就绪
3. 断言行数为 1、名称为临时应用、组件工作负载数为 1、版本 v1、健康为健康
4. 点击名称进入详情，断言行加载出该工作负载与就绪/期望、selector 与返回链接
5. 从应用列表页点击「自制应用」入口，确认到达同一页面

## 期望结果

- 列表来自 /kapis/resources…/namespaces/<ns>/applications，组件由 selector 匹配计算
- 健康由 matched workloads 的 readyReplicas 与 replicas 计算；无组件时未知
- 页面只读（无创建/删除入口），空集合显示空态

## 失败排查

- 行数为 0：确认 Application 在 namespace 下且 selector 与 Deployment 标签一致
- 组件数为 0：检查 kapis resources 的 deployments 标签读取

## 产品改版后如何更新自动化

- 句柄：composed-apps:surface/table/name:<name>/retry/back、installed-apps:composed-link
