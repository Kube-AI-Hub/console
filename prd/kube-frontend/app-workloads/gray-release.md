# 灰度发布列表（L3）

[子模块需求](./_index.md)

## 概述

项目控制台的「灰度发布」页按行列出本项目内的 servicemesh `Strategy` 自定义资源：名称、类型、目标服务与控制器给出的状态。servicemesh 在本集群已启用（`strategies` 接口 200，当前 0 个对象），老 console 也有这一页；新 UI 此前只登记为 planned。

本轮只做**只读列表**：创建灰度发布是多步向导（版本、流量比例、匹配规则），写类 webhook 仍不稳定，因此本页不提供创建、编辑或删除，空态明确说明「创建后会列在这里」。

## 用户故事

### US1 - 看到项目里有哪些灰度发布及其实施状态 (Priority: P1)

作为 **项目运维**，我希望 **在项目内一页看到所有灰度发布策略的名称、类型、目标服务与状态**，以便 **不进入命令行就能判断某个发布是否完成、失败或仍在进行**。

**Independent Test**：项目内存在一个 Canary 策略时，打开灰度发布页，列表出现该行且列头为名称/类型/目标服务/状态；项目内没有策略时，页面显示明确的空态。

## 验收场景

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01** — 已知项目内没有灰度发布策略，当打开灰度发布页，则页面进入空态并说明创建后会列在这里；已知项目内存在一个 `type=Canary` 的策略，当打开同一页面，则出现列头「名称 / 类型 / 目标服务 / 状态」，该行带稳定句柄且类型显示为「金丝雀发布」、目标服务取自策略的 Istio host、状态是已完成/进行中/失败/未知之一；读取失败时页面给出重试入口。

## 设计目标

1. **状态可读**：CRD 没有 `phase`，状态从 `status.conditions` 的 `Complete`/`Failed` 派生，未知状态单独成档而不是伪装成健康。
2. **目标服务可读**：从 Istio host 派生，回退到选择器 app 标签与模板名，避免「有目标却显示 -」。
3. **空态与失败态分明**：0 条是正常空态，读取失败是可重试的错误面板。

## 约束与边界

- 作用域：项目级，路由 `/kube-frontend/:workspace/clusters/:cluster/projects/:namespace/grayrelease`。
- 数据源：`/apis/servicemesh.kubesphere.io/v1alpha2/namespaces/<ns>/strategies`（原生 CRD 端点；kapis 代理同样 200，但原生返回完整对象与 status）。多集群路径未在本环境验证。
- 列：名称（别名优先）、类型、目标服务、状态；支持按名称/创建时间排序、按名称或目标服务搜索（客户端过滤，策略数量少）。
- 只读：本轮没有创建/编辑/删除，也没有详情页；行操作区为空。
- 状态映射：`Complete=True` → 已完成；`Failed=True` → 失败；有其它 condition 或 `completionTime` 缺失 → 进行中/已完成；无 condition → 未知。

## UI 交互设计

- 页面外壳 `data-ai-id="grayrelease:surface"`，四态 `loading/ready/empty/error`。
- 列表复用 `ResourceList`：搜索框句柄 `grayrelease:search`，行句柄 `data-ai-row=<名称>`，排序前缀 `grayrelease`。
- 空态：标题「暂无灰度发布任务」，说明「创建灰度发布任务后，这里会列出策略与状态。」
- 错误态：`ResourceErrorPanel` 带重试（`grayrelease:retry`）。
- 类型与状态用徽章显示；状态徽章带 condition 消息作为 `title`，失败/进行中的原因可在悬停时读到。

## 文案与校验

| key | 中文 | 英文 |
| --- | --- | --- |
| `grayRelease.title` | 灰度发布 | Canary Releases |
| `grayRelease.description` | 查看项目内的金丝雀发布、蓝绿部署与流量镜像策略；本页只读。 | Canary, blue-green and traffic-mirroring strategies in this project; read-only. |
| `grayRelease.column.name` | 名称 | Name |
| `grayRelease.column.type` | 类型 | Type |
| `grayRelease.column.targetService` | 目标服务 | Target service |
| `grayRelease.column.status` | 状态 | Status |
| `grayRelease.emptyTitle` | 暂无灰度发布任务 | No canary releases |
| `grayRelease.emptyDescription` | 创建灰度发布任务后，这里会列出策略与状态。 | Strategies you create will be listed here with their status. |

- 类型未知时原样显示 `spec.type`，不猜测；状态未知显示「未知」。

## 边界情况

- 项目内 0 个策略：空态，不显示表格与列头。
- servicemesh 模块未启用或接口 404：走错误态并提供重试，不伪装成空态（空态会让人以为没有发布）。
- 策略缺少 `spec.type`：类型列显示 `unknown`；缺少 template/hosts：目标服务按选择器与模板名回退，仍无则显示「-」。
- 策略刚创建、控制器尚未写入 condition：状态为「未知」，而不是「失败」。
- 策略数量很多：列表当前一次读取全部（控制器每项目写入数量有限），搜索/排序在客户端完成。

## 明确不做

- 不提供创建灰度发布（多步向导：蓝绿/金丝雀/流量镜像、版本与流量比例、匹配规则）。
- 不提供编辑流量比例、编辑匹配规则、删除策略与查看详情。
- 不展示老 console 卡片上的请求量/成功率/延迟曲线（需要监控指标与图表）。
- 不迁移创建入口的分类页（灰度发布创建类型选择）。
- 不在集群级作用域提供跨项目灰度发布列表。

## 假设

- 集群已启用 servicemesh，且当前账号对 `strategies` 有读权限。
- 策略由 servicemesh 控制器维护，页面只读。
- 项目内策略数量足够小，客户端搜索与排序可接受。

## 功能需求

- **FR-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：系统必须在项目控制台提供灰度发布列表，展示名称、类型、目标服务与派生状态，并在无数据时给出明确空态、读取失败时给出重试入口。

## 成功标准

- **SC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01**：0 条策略时页面为空态且文案说明原因；存在策略时列头与行内容与对象字段一致；状态徽章与 `status.conditions` 一致。

## 验收用例

- `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-GRAY_RELEASE-01`
