# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-10 节点列表 · vGPU 模式配置状态机

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-10`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

模式写入信号与 agent 完成状态明确区分。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-10** — host GPU 节点提供设置 vGPU 模式及参数，NVIDIA 支持独占/MIG/HAMi-core、寒武纪支持独占/dynamic-smlu/env-share。数量为正整数，比例为有限正数，仅提交当前模式参数；未变化不重复提交。风险确认后提交，提交时禁用关闭；success=true 仅表示信号提交。三秒轮询最多五分钟，以新 desired/status 时间戳和参数判断结果，区分等待、处理中、完成、失败、外部请求和超时。403 或业务失败保留输入；member 禁用并由 API 拒绝写入。B200 仅只读与取消，所有模式写测试拦截模拟。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US7 - 配置 vGPU 模式并确认处理结果 (Priority: P1)

作为 **集群管理员**，我希望 **查看和配置节点 vGPU 模式及参数**，以便 **经过风险确认后提交配置，并区分信号提交和实际完成**。

**Independent Test**：真实环境打开并取消；拦截写入验证参数、成功、失败、竞争请求、旧结果和超时，不切换生产节点模式。

## 前置与配置

- 所有 GPU endpoint 在打开表单之前已被测试拦截
- B200 仅执行真实读取和取消，不提交模式写入

## 测试步骤

1. 打开真实节点模式表单，核对当前值后取消
2. 模拟模式写入，核对风险确认和字符串参数 payload
3. 模拟完成、失败、外部请求、403、业务失败、旧结果和五分钟超时
4. 回读真实节点注解，与开始前比较

## 期望结果

- success=true 不立即显示完成，旧结果不能冒充新结果
- 失败保留输入，超时不重发写入
- 所有 PUT 被拦截，生产 desired/status 注解不变

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
