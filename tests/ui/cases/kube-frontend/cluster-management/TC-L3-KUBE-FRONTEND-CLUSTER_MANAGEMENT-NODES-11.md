# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11 节点详情 · 资源分配、健康与硬件拓扑

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes/gpu02`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

节点身份、负载、分配与硬件事实独立展示，保留已有排障入口。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-11** — 节点详情为紧凑身份侧栏与资源主栏；首屏展示节点 GPU/显存、CPU、内存、容器组与磁盘当前负载及可切换趋势，监控页展示全部趋势。Ready True 和压力类 False 为正常，Unknown 不误判健康；NTP 使用全局时间中位数。容量表展示全部资源的 Capacity、Allocatable、Requests、Limits，优先 status.allocated/allocatedLimits，仅 CPU/内存缺失时回退对应注解，分配率以 Allocatable 为分母并保留超过 100% 的事实。硬件页精确过滤当前节点的显卡与 RDMA 端口，展示传输类型、链路速率、后端健康和资源可用性；速率 bytes/s 转 Gb/s。拓扑分离 GPU/NIC 连接与 CPU/NUMA 亲和信息，用唯一 X 对角项识别设备，保留未知连接代码，点击高亮行列，无拓扑明确空态。详情复用已有 vGPU 配置弹窗，取消不写入；终端、调度、YAML、元数据及关联资源保留。1024/1280/1600 视口表格内部滚动，不撑宽页面。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 弄清某个节点为什么不健康 (Priority: P1)

作为 **集群管理员**，我希望 **点开一个节点看到它的状态条件、可分配量与污点**，以便 **判断它为什么不可用、还能不能再调度上去**。

**Independent Test**：从列表点进节点详情，核对条件数、可分配量与节点对象一致。

### US5 - 查看节点关联资源并维护元数据 (Priority: P1)

作为 **集群管理员**，我希望 **查看节点的容器组、事件与趋势并编辑标签和污点**，以便 **判断调度问题而不编辑整份节点 YAML**。

**Independent Test**：增加临时标签并回读；无效污点不能提交，取消不改原污点；切换关联资源和监控页签后得到该节点数据。

### US7 - 配置 vGPU 模式并确认处理结果 (Priority: P1)

作为 **集群管理员**，我希望 **查看和配置节点 vGPU 模式及参数**，以便 **经过风险确认后提交配置，并区分信号提交和实际完成**。

**Independent Test**：真实环境打开并取消；拦截写入验证参数、成功、失败、竞争请求、旧结果和超时，不切换生产节点模式。

## 前置与配置

- B200 gpu02 的节点详情、GPU 与 RDMA 只读接口可访问

## 测试步骤

1. 读取目标节点，核对 Requests/Limits 与压力类健康条件
2. 三档视口核对资源主栏、趋势和侧栏并截图
3. 打开 vGPU 配置后取消，捕获请求确认未产生写入
4. 打开硬件页，对账显卡和 RDMA 数量、速率与健康
5. 对照上报矩阵核对唯一 X 设备、亲和信息及选中高亮

## 期望结果

- 数据精确属于目标节点，数量与接口一致
- 容量单位与分配率正确，压力 False 显示正常
- 1024/1280/1600 页面不横向溢出，拓扑表内部可滚动
- 取消模式配置无 PUT，原终端和元数据入口保留

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
