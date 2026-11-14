# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01 JuiceFS 共享存储 · 三个页签

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `juicefs`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/juicefs-storage`
- **需求**: `prd/kube-frontend/cluster-management/juicefs.md`

## 产品功能

集群级 JuiceFS 共享存储页：卷列表、用量汇总与各卷用量、客户端性能趋势，共三个页签。

### 关联需求

- `prd/kube-frontend/cluster-management/juicefs.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/juicefs.md`](../../../../prd/kube-frontend/cluster-management/juicefs.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-JUICEFS-01** — 已知集群里安装了 juicefs-csi 且有共享卷，当打开集群级 JuiceFS 共享存储页，则「卷 / 用量 / 性能」三个页签可见且可切换；卷页签行数等于 JuiceFS 接口返回的卷数（为 0 时显示空态），并列出名称、状态、容量、已用、挂载点数、创建时间；用量页签显示卷数量、总容量、已用容量、最高使用率与各卷用量；性能页签在指标可用时显示客户端指标的最新/平均/最大值与趋势，指标不可用时给出明确说明。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/juicefs.md`](../../../../design/kube-frontend/cluster-management/juicefs.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/juicefs.md`](../../../../prd/kube-frontend/cluster-management/juicefs.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 定位共享存储写满或变慢的原因 (Priority: P1)

作为 **平台运维**，我希望 **在一个页面里看到共享卷的容量、已用与客户端性能**，以便 **在模型加载变慢或卷接近写满时，先判断是哪个卷、是容量问题还是缓存/延迟问题**。

**Independent Test**：打开集群级 JuiceFS 共享存储页，核对三个页签都可切换；卷页签行数等于 `/kapis/juicefs.kubesphere.io/v1alpha1/volumes` 返回的条数（0 条时显示空态）；用量页签显示卷数量与总容量；性能页签在指标可用时显示 9 个指标的统计与趋势。

## 前置与配置

- 已登录，且对 host 集群有读取权限
- 集群安装了 juicefs-csi；没有共享卷时卷页签显示空态（用例仍通过）

## 测试步骤

1. 用 API 读 JuiceFS 卷清单（/kapis/juicefs.kubesphere.io/v1alpha1/volumes）
2. 打开集群级 JuiceFS 共享存储页，核对三个页签可见
3. 核对卷页签：行数等于接口条数（0 条则空态）、表头六列
4. 切到用量页签，核对汇总卡与各卷用量条
5. 切到性能页签：有指标时核对指标表头与指标行；无指标时核对说明文案
6. 切回卷页签，核对内容仍在

## 期望结果

- 三个页签 tab 均可见且点击后内容切换
- 卷页签行数 = 接口返回条数；0 条时显示「暂无共享卷」
- 卷表头包含 名称/状态/容量/已用/挂载点数/创建时间
- 用量页签包含 卷数量/总容量/已用容量/最高使用率/各卷用量
- 性能页签在 ready 时包含 指标/最新/平均/最大/趋势 与至少一行指标
- 侧栏「存储」分组含 JuiceFS 共享存储入口

## 失败排查

- 页签不可见：页面没有注册到 registry 或 route 目录缺 index.tsx
- 卷页签 0 行但有数据：读接口时带了错误的集群前缀
- 性能页签一直 loading：summary.metricsEnabled 为 false 时仍去查询
- 状态/创建时间为空：PV join 未命中（卷名与 PV 名不一致）

## 产品改版后如何更新自动化

- 选择器见 pages/cluster_management.py 与 @/pages/cluster/JuiceFSStoragePage.tsx；卷行句柄是卷名，指标行是 cluster-juicefs:metric:<指标名>
