# 集群级配置 · 技术方案（L3）

[子模块需求](../../../prd/kube-frontend/cluster-management/cluster-config.md)

## 概述

保密字典、配置字典、服务账号三页跨项目只读列表。三页各有一个页面组件，共用「项目 → 企业空间」索引与行键规则；数据分别走 `secretsApi`、`configMapsApi`、`serviceAccountsApi` 的 `namespace: ''` 读取。

## 关联需求

- AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01

## 设计目标与非目标

目标：三页一套列语义与链接规则；行内能进到对象所属项目；大集合有加载态与错误重试。
非目标：集群级写操作、按项目/类型的服务端筛选、自定义资源类型。

## 关键约束

- 读集群级 kapis 集合（无 namespace 段）；参数只有 `limit` / `page` / `sortBy` / `ascending` / `name`。
- 不做 `fieldSelector`：kapis 代理忽略它（迁移计划 §52 实测），筛选控件会变成死控件。
- 项目 → workspace 只读一次命名空间列表；链接解析不到时回落 `public`。
- 只读：页面不渲染创建/删除/编辑入口。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01 — 三个页面文件，而不是一个带 kind 的组件

**为什么**：三页的专属列不同（类型 + 字段数 / 字段数 / 保密字典数），而且页面契约要求每个 `Page.tsx` 自己声明 `AiSurface` 状态；写成一个 kind 参数组件会让三个 Page 文件变成没有 `AiSurface` 的包装层，直接违反契约测试。共享部分收敛到 `useClusterProjectIndex` 与行键/链接函数，重复的只有列描述。
**被否方案**：一个 `ClusterConfigPage kind=…` 组件 + 三个薄包装。被否原因是契约与可读性，不是代码量。
**何时重新考虑**：出现第四、第五个同构配置资源，或三页的列开始分叉到需要各自的数据形状时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-02 — 行键用「项目/名称」，不用名称

**为什么**：名称在跨项目列表里不唯一——`kube-root-ca.crt` 在每个命名空间都存在。名称单键会让 React 键重复，也让自动化的行定位器一次匹配多行，测试会随机失败。
**被否方案**：沿用工作负载页的 `data-ai-row=name`。工作负载的镜像/部署名通常唯一，配置对象不满足这个前提。
**何时重新考虑**：列表改为按项目分组渲染、每行不再跨项目时。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-03 — configmaps 用 `namespace: ''` 而不是 `scope: 'cluster'`

**为什么**：`configMapsApi` 的 `scope: 'cluster'` 生成的 URL 完全不带集群段；在成员集群页面上它会读成 **host** 集群的配置字典。`namespace: ''` + 默认项目作用域在 host 上同样是无 namespace 段的集合，在成员集群上保留 `clusters/<id>` 段，因此两种集群都读对。secrets / serviceaccounts 的 `resourceApi` 本身就是这个行为。
**被否方案**：三页统一显式传 `scope: 'cluster'`。只在 host 上验证过，成员集群会静默读错集群。
**何时重新考虑**：api-client 为 cluster scope 正确带上集群段之后。

## 系统现状

老 console 在集群管理的「配置」分组下有这三页，列含 PROJECT，行内可跳项目。项目作用域的三页（可编辑）已在 `pages/{secrets,configmaps,serviceaccounts}` 交付；本方案只补集群作用域只读视图，编辑仍在项目页。registry 条目与 `cluster.config.*` 标题键已存在，路由目录与页面需新建。

## 仓库落点

- 页面：`apps/console-next/src/pages/cluster/ClusterSecretsPage.tsx`、`ClusterConfigMapsPage.tsx`、`ClusterServiceAccountsPage.tsx`
- 共用：`apps/console-next/src/pages/cluster/useClusterProjectIndex.ts`（项目索引、链接、行键）
- 路由：`routes/kube-frontend.clusters.$cluster/{secrets,configmaps,serviceaccounts}/{route,index}.tsx`
- 注册：`areas/registry.ts` 的 `groupKey: 'cluster.nav.groupConfig'`（已预置）
- 用例：`tests/ui/specs|tests/kube-frontend/cluster-management/`

## 对外契约

| 用途 | 路径 | 参数 |
| --- | --- | --- |
| 保密字典（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/secrets | limit, page, sortBy, ascending, name |
| 配置字典（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/configmaps | 同上 |
| 服务账号（跨项目） | /kapis/resources.kubesphere.io/v1alpha3/serviceaccounts | 同上 |
| 命名空间（取 workspace） | /kapis/resources.kubesphere.io/v1alpha3/namespaces | limit=500 |

## 不变量

1. 行数 = `min(20, total)`。
2. 项目列 = 对象的 `metadata.namespace`。
3. 名称链接含 `/projects/<namespace>/<kind>/<name>`，并带 workspace 段。
4. 三页都不出现项目工作区栏，也没有写操作。

## 已知坑

- **代理忽略 fieldSelector**：筛选不做（迁移计划 §52）。别把「按项目筛选」做成前端过滤当前页，那只会筛 20 行。
- **名称跨项目不唯一**：行键必须是项目/名称（DEC-02）。
- **configmaps 的 scope 语义**：`scope: 'cluster'` 丢集群段（见本文件关于 scope 语义的历史决策）。
- **locale 键是项目级复用的**：`secrets.column.fieldCount`（en 为 Keys）、`configmaps.column.keys`、`serviceaccounts.column.secrets` 来自项目页词典；没有专门的 `cluster.config.column.*`。要改中文措辞（键数/密钥数）需要先加 locale 键。
- **集群级列表慢**：首屏可达数秒，测试与页面都要用大于默认 20 秒的等待。

## 测试与可观测

- 用例：`tests/ui/specs/kube-frontend/cluster-management/TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01.yaml`
- 可观测点：`cluster-secrets:surface` / `cluster-configmaps:surface` / `cluster-serviceaccounts:surface`（`data-ai-state` 为 loading/ready/empty/error），搜索框 `<ai id>:search`，行句柄 `data-ai-row=<namespace>/<name>`。
- 失败可从 DOM 读到错误面板与重试按钮（`<ai id>:retry`）。

## 后续改进

- 补 `cluster.config.column.*` locale 键，让中文列标题直接叫「键数 / 密钥数」。
- 服务端支持跨项目筛选后，再加项目/类型下拉（当前做会是不生效的控件）。
- 成员集群上的三页集成验证（本环境只有 host 集群）。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_CONFIG-01
