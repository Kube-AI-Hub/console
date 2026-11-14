# 镜像构建器 · 技术方案（L3）

[需求](../../../prd/kube-frontend/app-workloads/s2ibuilder.md)

## 概述

项目级只读列表：从 devops 组的 **v1alpha1** 命名空间端点读取 S2iBuilder，展示名称、基础镜像、最近构建状态与创建时间。页面不创建也不触发构建；空态是当前集群的真实状态（25 个命名空间均无构建器）。

## 关联需求

- AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01

## 设计目标与非目标

目标：用正确版本读 S2I 资源、字段与老 console 一致、没有数据时诚实显示空态。

非目标：创建/编辑/删除构建器、触发重新构建、s2irun 历史与日志、构建器详情页。

## 关键约束

- 端点：GET /apis/devops.kubesphere.io/v1alpha1/namespaces/<namespace>/s2ibuilders（CRD，Namespaced）。
- 版本拆分实测：/apis/devops.kubesphere.io 同时有 v1alpha1 与 v1alpha3；v1alpha3 的资源清单没有 s2ibuilders，请求它是 404。
- 字段：metadata.name/creationTimestamp/labels/annotations；spec.config.builderImage/imageName/tag；status.lastRunState。
- 当前无实例：默认项目 0，集群 25 个命名空间全部 0；s2ibuildertemplates 有 5 个，说明模块已安装。
- kapis 的 v1alpha1 路径也返回 200（信封带 metadata.remainingItemCount），本项目统一读 /apis 的 CRD 列表。

## 方案决策

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01 — 读 v1alpha1，而不是 v1alpha3

**为什么**：devops 组把 S2I 资源留在 v1alpha1，v1alpha3 只有流水线/工程；对 v1alpha3 请求 s2ibuilders 的 404 很容易被误判成「功能不存在」。探测确认 v1alpha1 的资源清单含 s2ibuilders，并且命名空间列表返回 200，CRD 也是 v1alpha1。

**被否方案**：用 API 组发现结果猜版本。两个版本同时存在，猜中概率一半，且猜错的表现与「未安装」无法区分。

**何时重新考虑**：平台把 S2I 资源迁到 v1alpha3 时（届时两个版本可能要同时支持）。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-02 — 只读列表，不迁移创建与构建

**为什么**：创建 S2iBuilder 会连带创建 s2irun 并启动构建，属于写流程；本轮没有任何现成构建器可验证写路径，且任务边界是列表。页面因此不提供创建入口，空态说明来源；写能力另立功能点。

**被否方案**：先放一个创建按钮跳未实现路由。会制造死链，且让读者以为构建器可以在这里创建。

**何时重新考虑**：创建/S2I 运行流程作为独立功能点落地时。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-03 — 状态按 lastRunState 派生，未知值按尚未构建

**为什么**：构建器的运行状态只由 controller 写在 status.lastRunState（Running/Successful/Failed，未运行为空）；列表不读 s2irun。未知值按「尚未构建」显示，而不是把 controller 的私有值原样抛给读者。

**被否方案**：展示原始字符串。英文枚举值混在中文界面里，且空值会变成空白单元格。

**何时重新考虑**：controller 增加更细的状态时，补映射。

### DEC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-04 — registry 从 planned 改为 ready，页面接受空数据

**为什么**：区域条目早就登记但标 planned；探测确认 API 可读，功能从「未迁移」变为「已迁移的只读列表」。当前没有实例是数据状态，不是功能状态；空态文案解释来源，导航可以打开。

**被否方案**：继续标 planned。会让已经可用的页面在侧栏里显示未迁移标记，与实际不符。

**何时重新考虑**：页面在真实数据下出现 API 不可用/权限问题时，回到 planned 并记录原因。

## 系统现状

老 console 的项目「镜像构建器」页有创建、编辑、删除与详情（详情里看运行记录、重新构建、构建日志）。本实现只迁移列表：名称/基础镜像/状态/创建时间，只读；写与运行记录明确不做。

## 仓库落点

- 页面：apps/console-next/src/pages/app-workloads/ImageBuilderPage.tsx
- 路由：apps/console-next/src/routes/kube-frontend.$workspace.clusters.$cluster.projects.$namespace/s2ibuilder/
- 接口：packages/api-client/src/s2ibuilder.ts（imageBuildersApi、toImageBuilderSummary）
- 区域注册：areas/registry.ts（devops-project → page s2ibuilder，status ready）
- 文案：packages/locales/src/index.ts 的 devopsProject.s2ibuilder.*

## 对外契约

| 用途 | 路径 | 方法 | 实测 |
| --- | --- | --- | --- |
| 构建器列表 | /apis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibuilders | GET | 200，{items}；默认项目 0 条 |
| 构建模板 | /apis/devops.kubesphere.io/v1alpha1/s2ibuildertemplates | GET | 200，5 条（说明模块已安装） |
| 错误版本 | /apis/devops.kubesphere.io/v1alpha3/namespaces/<ns>/s2ibuilders | GET | 404（v1alpha3 没有该资源） |
| kapis 等价 | /kapis/devops.kubesphere.io/v1alpha1/namespaces/<ns>/s2ibuilders | GET | 200（信封不同，本实现不用） |

字段映射：

| 页面字段 | 来源 |
| --- | --- |
| 名称 | metadata.annotations.displayName，缺省 metadata.name |
| 类型 | metadata.labels["s2i-type.kubesphere.io"]（b2i；其余按 s2i） |
| 所属服务 | metadata.annotations.serviceName |
| 基础镜像 | spec.config.builderImage |
| 状态 | status.lastRunState（Running→构建中、Successful→构建成功、Failed→构建失败、空/未知→尚未构建） |
| 创建时间 | metadata.creationTimestamp |

## 不变量

1. 读取的是 v1alpha1 命名空间端点；v1alpha3 不参与。
2. 页面状态与接口 items 一致：0 → empty，>0 → ready，请求失败 → error + retry。
3. 状态只来自 lastRunState；未知值显示尚未构建。
4. 页面不发起任何写请求。
5. registry 条目 ready 且可打开 /projects/<ns>/s2ibuilder。

## 已知坑

- **v1alpha3 404 是版本拆分**：同组两个版本并存，S2I 只在 v1alpha1；按版本找不到资源不等于模块未安装。
- **集群当前没有任何构建器**：默认项目与 25 个命名空间都为 0；页面必须把空态当正常状态展示，测试不能假设有行。
- **builderImage 可能缺失**：B2I/旧对象没有该字段时显示 -，不要回退到 imageName（那会导致读者以为构建镜像就是产物镜像）。
- **displayName/serviceName 是注解**：缺失时回退 name/隐藏副行，不显示空字符串。
- **kapis 信封不同**：kapis 响应带 metadata.remainingItemCount 而不是标准 items/totalItems；本项目读 /apis，避免另一套解析。
- **状态大小写**：controller 用首字母大写枚举，比较前统一小写。

## 测试与可观测

- E2E：tests/ui/specs/kube-frontend/app-workloads/TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01.yaml：先读 API items 数，打开页面等 state 非 loading；0 条断言空态与说明，>0 断言行数与列；并断言页面无写请求。
- 可观测点：image-builder:surface、image-builder:retry、data-ai-row。
- 失败时先看：是否请求了 v1alpha3、项目命名空间是否正确、API 是否 200。

## 后续改进

- 创建/编辑/删除镜像构建器（含触发 s2irun）。
- 构建运行记录与日志（s2irun 列表 + 流式日志）。
- 构建器详情页。

## 验收用例

- TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-01
