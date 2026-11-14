# 集群概览（L3）

[子模块需求](./_index.md)

## 概述

集群的落地页。用一屏回答三个问题：**这是什么集群**（供应者、Kubernetes 与 Kube AI Hub 版本、连接方式、API 端点、就绪状态）、**它有多忙**（CPU / 内存 / 容器组 / 节点 / GPU 卡的已用与总量，以及控制面的请求速率、延迟与调度结果）、**装了哪些模块**（告警、监控、日志、网关等）。

老 console 的集群首页同样是仪表盘而不是列表，本功能点是它的对位迁移。

## 用户故事

### US1 - 打开集群先看整体是否正常 (Priority: P1)

作为 **集群管理员**，我希望 **进入集群的第一屏就能看到就绪状态、版本、节点数与资源用量**，以便 **不必先点进节点或监控才能判断这个集群能不能用**。

**Independent Test**：打开集群概览，核对「基本信息」与「资源用量」两块都渲染出真实值，且状态徽标与集群对象的 Ready 条件一致。

### US2 - 判断「有没有空间」而不是只看百分比 (Priority: P1)

作为 **集群管理员**，我希望 **已使用、总量、使用率和已分配各自对齐呈现**，以便 **区分「跑得满」和「申请满了但实际很闲」——后者意味着新 Pod 调不进来**。

**Independent Test**：核对 CPU、内存卡分别出现已使用、总量、使用率与已分配字段，且数值与监控接口返回一致；不存在合并斜杠文本的依赖。

### US3 - 知道这个集群装了哪些可选模块 (Priority: P2)

作为 **集群管理员或支持人员**，我希望 **概览列出已启用与未启用的模块**，以便 **在排查页面不可用时确认配置开关，而不把开关误当成 API 安装证明**。

**Independent Test**：核对模块区分为「已启用」与「未启用（N）」两组，条目与集群对象 status.configz 一致。

### US4 - 没有监控后端时页面仍然可用 (Priority: P2)

作为 **集群管理员**，我希望 **监控缺失只影响用量面板并明确说明**，以便 **仍然能看到版本、就绪状态与模块信息**。

**Independent Test**：在监控接口返回失败的环境下打开该页，核对基本信息与模块区正常渲染，用量面板显示「监控数据不可用」而不是 0。

## 验收场景

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01** — 已知已登录且对集群有读取权限，当打开集群概览页，则「基本信息」显示状态徽标（就绪时「运行正常」并附条件消息）、供应者、Kubernetes 版本、Kube AI Hub 版本、节点数、连接方式、API 端点与描述；「已启用模块」列出 status.configz 中为真的模块、「未启用」列出为假或缺失的模块，不代表 API 未安装；页面不出现项目工作区栏。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02** — 已知集群存在且监控后端可用，当查看「资源用量」，则 CPU、内存、容器组、节点各显示已使用、总量与使用率，CPU 与内存额外显示已分配；集群有 GPU 时显示 GPU 实际使用、总数和独立已分配量，不再附加 GPU 利用率文本行；当监控接口不可用时，用量面板显示监控不可用说明而不是 0 或空白，基本信息与模块区不受影响。Kubernetes 状态保留请求速率、延迟、scheduled/error/unschedulable 五字段。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03** — 概览在 1024/1280/1600 视口采用身份与模块侧栏、资源和控制面主栏，不撑宽页面；提供节点、显卡、监控与 kubectl 的当前集群快捷入口和协调刷新，进入 kubectl 不自动连接。代理未就绪集群保留 agent 接入说明。部分指标缺失或分母为零显示 `-` 且不绘制 0% 进度条，真实零采样显示 0%；集群用量不引用单节点数据。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04** — 资源用量保留 GPU 显存、GPU 实际使用、CPU、内存、容器组、磁盘六类及新增节点就绪率；每类有使用/总量和比例，GPU/CPU/内存分配量独立显示，GPU 数量允许小数。显存/磁盘为 bytes，按 GiB/TiB 显示；缺失不填零。Kubernetes 状态保留 scheduled 和 error，并额外保留 unschedulable，按 result 标签对账，不能互相替代。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05** — 基本信息显示集群可见性；六类系统组件入口按当前集群和分类进入列表，可清除分类，详情保持同集群。kubectl 不自动连接；主动打开 kubeconfig 时只读当前用户/集群配置，显示安全提示并可下载 kubeconfig.yaml。关闭取消读取并清除敏感缓存，身份或集群变化不显示旧内容，403 不提供重试；不记录或截图凭据正文。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06** — 首页 Top5 默认 GPU 显存利用率，九项指标（GPU 显存/GPU/GPU 分配/CPU/load1/内存/磁盘/inode/容器组利用率）可切换，按整个集群服务端降序取五项而非当前节点列表页排序。节点名链接详情并显示 IP、控制面标记；GPU 分配按卡数排序、按 allocated/total 显示比例，load1 不乘100，未知不填零。“查看更多”保留指标进入服务端分页完整排行，可搜索、排序、刷新及选择每页档位。
- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-07** — Kubernetes 状态位于左列基本信息正下方，模块仍在该列；右列为资源、排行、组件和工具。资源卡统一名称、已使用、总量、使用率、已分配的栅格位置，无分配字段留空不显示标签，真实零仍显示，未知值不伪造为零。移除 GPU 卡额外利用率行；图标、进度条及 Top5 小条形图来自共享 ai-kit，图标不替代文字。全部区块使用与节点详情一致的 border-ai-line/bg-ai-surface-1，1024/1280/1600 下字段对齐且不撑宽页面。

## 设计目标

1. **一屏分层**：先「是什么」，再「多忙」，再「装了什么」——顺序对应读者的问题顺序。
2. **数字要能自证**：任何百分比旁边必须有分子分母；任何单点数字必须能对应到一个具体资源。
3. **降级要说明理由**：缺数据时说明缺什么，不显示 0。

## 约束与边界

- 读集群对象 /kapis/cluster.kubesphere.io/v1alpha1/clusters/<id>。
- 读监控 /kapis/monitoring.kubesphere.io/v1alpha3/cluster 与 /components/{apiserver,scheduler}（KubeSphere 监控 API，不是 metrics.k8s.io）。
- 只读：本页不提供任何写操作。
- 不依赖指标历史：只取当前值，不画趋势曲线。

## UI 交互设计

- 顶部包含集群名、标题和刷新；宽屏左侧依次为基本信息、Kubernetes 状态和模块，右侧优先资源用量。窄屏纵向排列；代理接入提示保留。
- 资源卡统一名称、已使用/总量双列、使用率与进度条、分配量固定区域；不支持的分配字段留空，无额外 GPU 利用率文本行。
- 进度条宽度与百分比同源；颜色不是唯一信息通道（同时给数字）。
- 模块以徽标（已启用）与弱化文字（未启用）两种形态出现；原始键名放 title，悬停可见。
- 资源卡后为 Top5，随后为系统组件与工具；完整排行使用同一读模型及共享表格/分页。配置开关徽标不替代组件入口。

## 文案与校验

- 状态：就绪且启用 →「运行正常」；未就绪 →「未就绪」；spec.enable 为 false →「已停用」。
- 平台版本字段标签为「Kube AI Hub 版本」（英文「Kube AI Hub version」），locale key 为 `cluster.overview.productVersion`，数值仍读 `status.kubeSphereVersion`。
- 缺值统一 -。
- 延迟在 1 秒以下按毫秒显示（14.85 ms），1 秒以上按秒。
- 「无法调度」仅在非零时用警示色强调。

## 边界情况

- 监控后端缺失：用量面板显示「监控数据不可用」加一句说明，页面其余部分照常。
- 集群无 GPU：不渲染 GPU 行（0 / 0 读起来像功能坏了，而 CPU-only 集群是正常形态）。
- 未知模块键：原样显示键名（configz 是开放的，任何插件都可能新增），不丢弃。
- 集群对象读取失败：显示错误面板与重试。
- 集群 Ready 条件缺失：按未就绪处理，不默认健康。

## 功能需求

- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01** — 基本信息来自集群对象，就绪状态只认 Ready 条件的 True。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02** — 用量与 Kubernetes 状态来自 KubeSphere 监控 API，一次请求取多个指标。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03** — 监控不可用时页面降级而非整体失败。
- **FR-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04** — 模块列表区分已启用与未启用，未知键原样显示。

## 成功标准

- **SC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01** — 基本信息、用量、模块三区的值与同名接口返回一致；监控不可用时页面仍可读。

## 明确不做

- 集群设置（编辑描述、可见性、可插拔组件开关）：需平台侧写接口，当前迁移范围外。
- 用量趋势曲线与历史：需要指标历史接口，本页只取当前值。
- 不提供 kubeconfig 编辑或更新成员集群连接配置；只读用户配置与连接配置不是同一任务。原“不提供下载”判断已在 2026-11-15 复盘后反转。
- 不重复节点属性列表；原“节点页承担 Top5”判断缺乏等价证明，现恢复概览预览与完整排行下钻。

## 假设

- 集群对象的 status.configz 以「模块名 → 布尔」的形式给出配置启用状态，不证明 API 安装状态。
- 监控 API 在未安装监控时返回错误而非空结果；两种情形都按「不可用」处理。

## 验收用例

- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-01
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-02
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-03
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-04
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-05
- TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-06
