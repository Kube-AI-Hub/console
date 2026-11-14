# 编辑 YAML 覆盖（L3）— 技术方案

[子模块技术方案](./_index.md)

## 概述

把节点、持久卷、存储类型与网络策略的详情页接到既有的 `YamlDialog` 与 `resourceApi.update` 写路径上；为网络策略补一个项目作用域的详情页，作为「编辑 YAML」的落点。

## 关联需求

- `AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01`
- `prd/kube-frontend/cluster-management/yaml-edit.md`

## 设计目标与非目标

- **目标**：四类详情页的编辑 YAML 与工作负载/配置字典完全同一套交互与写路径；存储类型的写路径落在 `storage.k8s.io/v1`。
- **非目标**：不新增列表页 YAML 入口，不给 PV/SC 补删除，不做节点污点/标签专用表单。

## 关键约束

- `YamlDialog` 接收初始 YAML 文本与 `lockName`；解析与名称校验都在组件内。
- `resourceApi.update` 按资源名查表得到 API 组；未登记的资源回退核心组，写入会 404。
- 节点与持久卷是核心组，存储类型是 `storage.k8s.io/v1`，网络策略是 `networking.k8s.io/v1`。
- 详情页的查询缓存 key 必须与失效 key 一致，否则保存后页面仍是旧值。

## 方案决策

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01 — 复用 `YamlDialog` 与 `resourceApi.update`，不写第二套编辑器

**为什么**：配置字典、保密字典、服务账户、工作负载的 YAML 编辑已经共用 `YamlDialog` 与 `resourceApi.update`；四类新对象只差「把 raw 对象放进 detail」「选对 API 组」两件事。各写一份编辑器会让上传/下载、名称锁定、解析校验与错误提示逐渐分叉。

**被否方案**：在详情页里直接嵌 CodeMirror 并手写 PUT。省一次组件复用，但要再实现上传/下载、锁定与语法校验，且无法共享后续改进。

**何时重新考虑**：当某类对象需要「编辑前先取最新版本」的额外弹窗（工作负载列表的编辑就是这种形态）时，再在组件外叠加，而不是复制组件。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-02 — 网络策略补详情页，而不是在列表里加编辑弹窗

**为什么**：网络策略的 YAML 编辑需要一个持有当前对象的地方。列表行只有摘要，编辑要先按名字再读一次对象；项目网络隔离页已经承载创建/删除与隔离开关，再塞一个编辑弹窗会让一个页面同时管理三种不同的写操作。项目作用域补详情页后，链接与面包屑和老 console 的形状一致，YAML 编辑落在对象自己的页面。

**被否方案**：在项目网络隔离列表的行操作里直接开 YAML 弹窗。少一个路由，但列表页要额外保存「正在编辑的对象」与它的完整内容，且详情信息（规则、选择器）仍无处展示。

**何时重新考虑**：若网络策略详情只需要 YAML、不需要任何只读区块，可以退化为列表内弹窗。

### DEC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-03 — 存储类型的组登记在 `RESOURCE_GROUPS`

**为什么**：`resourceApi.update` 的写路径由 `kubePrefix(resource)` 决定，表里没有 `storageclasses` 时回退 `/api/v1`，而 StorageClass 只在 `/apis/storage.k8s.io/v1` 下；表现是「读得到、写 404」。把组补进表，并用单测固定。

**被否方案**：在 storage 模块里手写路径。会让「路径由一张表决定」的不变量出现第二个例外。

**何时重新考虑**：接入 CRD 时，组与版本要来自发现接口而不是静态表。

## 系统现状

- 工作负载、配置字典、保密字典、服务账户、存储卷与快照、自定义监控已有 YAML 编辑；节点/持久卷/存储类型/网络策略没有。
- 持久卷详情原来注释写明「有意只读」；网络策略只有项目网络隔离页，没有详情路由。
- 存储类型的详情接口走 `/kapis/.../storageclasses`，写接口此前没有调用点。

## 仓库落点

| 层 | 路径 | 改动 |
| --- | --- | --- |
| 接口 | `kube-frontend/packages/api-client/src/resources.ts` | `RESOURCE_GROUPS` 登记 `storageclasses` |
| 接口 | `kube-frontend/packages/api-client/src/storage.ts` | `NodeDetail`/`PersistentVolumeDetail`/`StorageClassDetail` 带 `raw`；`persistentVolumesApi.update` |
| 接口 | `kube-frontend/packages/api-client/src/iam.ts` | `NetworkPolicyDetail` 与 `toNetworkPolicyDetail`；详情也用该映射 |
| 页面 | `pages/cluster/NodeDetailPage.tsx` | 头部「编辑 YAML」+ 弹窗 + 写 mutation |
| 页面 | `pages/cluster/PersistentVolumeDetailPage.tsx` | 同上 |
| 页面 | `pages/cluster/StorageClassDetailPage.tsx` | 同上 |
| 页面 | `pages/settings/NetworkPolicyDetailPage.tsx` | 新增详情页 |
| 路由 | `routes/…/networkpolicies/$name.tsx` | 新增路由；列表页名称改为进详情的链接 |
| 文案 | `kube-frontend/packages/locales/src/index.ts` | 复用既有键，不新增 |

## 对外契约

| 契约 | 形式 | 说明 | 谁会消费 |
| --- | --- | --- | --- |
| `PUT /api/v1/nodes/<name>` | Kubernetes 对象 | 核心组写；带 `resourceVersion` | apiserver |
| `PUT /api/v1/persistentvolumes/<name>` | Kubernetes 对象 | 核心组写；读用同一快接口 | apiserver |
| `PUT /apis/storage.k8s.io/v1/storageclasses/<name>` | Kubernetes 对象 | 组由 `RESOURCE_GROUPS` 决定 | apiserver |
| `PUT /apis/networking.k8s.io/v1/namespaces/<ns>/networkpolicies/<name>` | Kubernetes 对象 | 项目作用域详情页 | apiserver |
| `node-detail:edit-yaml` / `pv-detail:edit-yaml` / `sc-detail:edit-yaml` / `networkpolicy-detail:edit-yaml` / `yaml:submit` | `data-ai-id` | 打开与提交入口 | 自动化与智能体 |

## 不变量

- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01**：编辑 YAML 的提交对象与打开时的对象只差用户编辑的字段；名称与打开时一致。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-02**：每个资源的读、写、删走同一 API 组；组由一张表决定。
- **INV-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-03**：保存失败时弹窗不关闭，编辑器内容不丢失。

## 已知坑

| # | 反直觉事实 | 如果不知道会怎样 | 在哪处理 |
| --- | --- | --- | --- |
| **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01** | 未在 `RESOURCE_GROUPS` 登记的资源回退核心组 | StorageClass 写入 404，且读接口正常，表现为「读得到、写不了」 | 表里登记 `storageclasses`，单测覆盖 |
| **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-02** | 文件式路由里父路由不渲染 `<Outlet/>`，子路由不显示 | 加了 `$name.tsx` 却仍渲染列表页 | 项目网络策略已有带 `Outlet` 的 `route.tsx` |
| **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-03** | PV 的 `spec.claimRef` 由绑定控制器写，直接改会与控制器争写 | 保存 409 或绑定信息被覆盖 | 弹窗显示服务端错误；不自动重试 |
| **GOT-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-04** | 详情查询的 key 与 mutation 失效的 key 不一致时，保存成功页面还是旧值 | 用户以为没保存 | 每个页面的 `invalidateQueries` 用与 `useQuery` 相同的 key |

## 测试与可观测

- **单元**：`packages/api-client/test/resources.test.ts` 覆盖 `kubePrefix` 的核心组/分组/未登记回退（含 `storageclasses`）；`storage.ts` 的 `raw` 映射由页面测试覆盖。
- **端到端**：`TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01` 用 fixture 存储类型走「改注解 → 回读 → 删除」，并检查四类详情页入口。
- **手动验证**：持久卷详情改一个注解保存；节点详情打开弹窗确认初始文档是当前节点；网络策略详情从项目隔离页名称进入。
- **日志 / 指标**：不适用；失败看 PUT 响应与弹窗内文本。

## 后续改进

- 若 CRD 实例也需要 YAML 编辑，组与版本改由发现接口提供，静态表退化为兜底。
- 网络策略详情补规则视图（入站/出站表格），与创建弹窗共用选择器解析。

## 验收用例

- `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-YAML_EDIT-01`
