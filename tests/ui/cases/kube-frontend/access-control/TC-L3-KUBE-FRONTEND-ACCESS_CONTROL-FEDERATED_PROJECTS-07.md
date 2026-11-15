# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07 联邦项目详情 · 传播条件、元数据与事件

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `federated-projects`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/federatedprojects`
- **需求**: `prd/kube-frontend/access-control/federated-projects.md`

## 产品功能

详情概览显示基本信息与传播条件表；元数据页签显示对象标签、对象注解与模板标签；事件页签显示该 FederatedNamespace 的事件；三者各自处理空、失败与无回报。

### 关联需求

- `prd/kube-frontend/access-control/federated-projects.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-FEDERATED_PROJECTS-07** — 已知一个联邦项目详情可用，当打开「概览」，则显示名称、别名、描述、命名空间、企业空间、部署集群、传播状态、创建时间、创建者，以及控制面回报的传播条件表（条件/状态/原因/消息/最近变更，无回报时显示明确说明）；当打开「元数据」页签，则分别列出对象标签、对象注解与模板标签（无条目的分组显示明确说明）；当打开「事件」页签，则列出该项目对象的事件（级别/原因/消息/次数/最近发生/来源），无事件与读取失败分别显示对应说明并可重试；已知详情头部，则「编辑信息 / 调整部署集群 / 删除」三个入口存在且各自打开对应确认或表单。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/federated-projects.md`](../../../../design/kube-frontend/access-control/federated-projects.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/federated-projects.md`](../../../../prd/kube-frontend/access-control/federated-projects.md)，与用例的 `story` 对应；改需求即改这里。

### US3 - 深入一个联邦项目的对象状态 (Priority: P2)

作为 **企业空间管理员**，当联邦项目没有按预期传播时，我希望 **看到控制面回报的传播条件、对象的标签与注解、以及与该对象相关的事件，并能下钻到每个联邦资源的完整对象 YAML 与事件**，以便 **判断是放置没生效、控制面拒绝还是同步失败**。

**Independent Test**：打开一个联邦项目详情，核对传播条件表与元数据页签；打开事件页签核对事件列；进入一个联邦资源详情，核对完整对象 YAML 与事件页签；对被删除的对象核对未找到说明。

## 前置与配置

- 已登录，联邦 API 可读写，至少一个就绪集群
- 预置一个唯一名称的联邦项目（宿主编 managed=true，放置 host）

## 测试步骤

1. 用 API 预置联邦项目并等待控制面回报 Propagation
2. 打开详情概览，核对基本信息字段与传播条件表
3. 打开「元数据」页签，核对对象标签、对象注解与模板标签三块
4. 打开「事件」页签，核对事件表或空态说明
5. 打开一个不存在名称的详情 URL，核对未找到说明
6. 清理：删除宿主命名空间并轮询到 404

## 期望结果

- 概览显示名称、别名、描述、命名空间、企业空间、部署集群、传播状态、创建时间、创建者
- 传播条件表至少一行 Propagation，状态为 True（或控制面未回报时显示「联邦控制面还没有回报传播条件。」）
- 元数据页签三块都存在；对象标签含 kubesphere.io/workspace，模板标签含 kubesphere.io/workspace
- 事件页签：有事件时表头为 级别/原因/消息/次数/最近发生/来源；无事件时显示「暂无事件。」而非空表
- 详情头部存在「编辑信息」「调整部署集群」「删除」三个入口
- 不存在的名称显示「该联邦项目不存在或已被删除。」
- 清理后对象与命名空间都不存在

## 失败排查

- 事件页签空白：事件接口按 involvedObject.kind=FederatedNamespace 过滤；检查 kind 拼写
- 条件表为空：控制面还没回报；等几秒重试，或记录为中间态
- 元数据为空：对象标签只写在 template 上；模板标签块应仍有 workspace

## 产品改版后如何更新自动化

- 选择器：federated-project:basic / :conditions / :tab:metadata / :metadata:{labels|annotations|template-labels} / :tab:events / :events[:empty|:error]
- 事件列变化时同步 FederatedEventsPanel
