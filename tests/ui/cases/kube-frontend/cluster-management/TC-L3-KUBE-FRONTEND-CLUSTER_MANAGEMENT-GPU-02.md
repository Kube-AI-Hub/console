# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-02 集群显卡 · 服务端筛选与共享分页

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `gpu`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/gpus`
- **需求**: `prd/kube-frontend/cluster-management/gpu.md`

## 产品功能

显卡筛选和分页不改变集群统计，并允许恢复列与条件。

### 关联需求

- `prd/kube-frontend/cluster-management/gpu.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/gpu.md`](../../../../prd/kube-frontend/cluster-management/gpu.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-GPU-02** — 列表以服务端 page/limit 分页，每页 10/20/50/100；UUID 精确匹配，节点和型号包含匹配，节点标签、厂商和健康筛选可组合并清除。筛选或每页条数改变回第一页，顶部 stats 始终保持集群总览。显示 NUMA、vGPU 模式、vGPU 与核心分配量；厂商和已知模式本地化。复用 ai-kit 工具栏、表格与分页，UUID 列不可隐藏，其余列可隐藏并恢复。无匹配、读取失败和无权限明确区分，失败保留可编辑条件，统计缺失不显示零。空 UUID 不发送过滤。未确认 member GPU 路由时拒绝读取，不静默显示 host 数据。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/gpu.md`](../../../../design/kube-frontend/cluster-management/gpu.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/gpu.md`](../../../../prd/kube-frontend/cluster-management/gpu.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 集群运维按节点核对每张卡的健康状态

作为 **集群运维**，我希望 **在集群显卡列表里按节点核对每张卡的状态**，以便 **判断某台机器是否还能继续接收 GPU 任务**。

**Independent Test**：打开 `/clusters/host/gpus`，表格行数等于当前分页 GPU 请求的 items 数，健康行数等于该页 `health:true` 的条数，顶部健康比例与全局 `/gpus/stats` 一致。

### US3 - 快速定位显卡并继续排障

作为 **集群运维**，我希望 **按 UUID、节点、节点标签、厂商、型号及健康状态定位卡，再查看监控和关联容器组**，以便 **不用在全量设备里逐行查找，也不把同节点的其他任务误作此卡任务**。

**Independent Test**：组合筛选和分页不改变顶部总览；从卡详情进入监控、容器组及事件页签，核对 UUID 过滤、指标单位与节点事件范围。

## 前置与配置

- B200 有可读取的 GPU 设备和统计

## 测试步骤

1. 按节点、厂商、型号和 UUID 组合过滤，核对请求与行数
2. 清除条件，核对集群统计保持不变
3. 拦截返回 125 张模拟卡，验证翻页、换每页条数、精确 UUID 搜索
4. 隐藏显存列并恢复，在三档桌面视口截图
5. 模拟读取错误，修正条件后恢复；不执行设备写入

## 期望结果

- 条件与分页由服务端执行，总量来自 totalItems
- UUID 列保留，列恢复可用，失败时条件仍可编辑
- 统计独立于当前页和筛选，无生产 GPU 状态变更

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
