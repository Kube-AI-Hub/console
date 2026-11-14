# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06 节点详情 · 元数据与关联资源

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

查看节点资源并以局部写入维护节点元数据。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-06** — 节点详情补充系统架构、操作系统类型、kube-proxy 与已上报的 GPU 信息，并展示全部扩展容量（GPU/RDMA 为数量，不换算为字节）。标签与污点编辑使用局部带版本写入；无效污点保留输入，取消不写入，NoExecute 风险明确。容器组按 spec.nodeName 过滤，事件按 Node 名称与类型过滤，监控展示该节点 CPU/内存/容器组趋势。列表支持刷新与每页条数。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 查看节点关联资源并维护元数据 (Priority: P1)

作为 **集群管理员**，我希望 **查看节点的容器组、事件与趋势并编辑标签和污点**，以便 **判断调度问题而不编辑整份节点 YAML**。

**Independent Test**：增加临时标签并回读；无效污点不能提交，取消不改原污点；切换关联资源和监控页签后得到该节点数据。

## 前置与配置

- 当前账号有节点读写权限，节点有监控采样

## 测试步骤

1. 添加唯一临时标签并提交，以 API 回读核对保存结果
2. 输入无效污点，验证错误后取消，核对原污点不变
3. 切换容器组与事件页签，确认独立数据视图可达
4. 打开监控页签，核对 CPU 趋势具有多个采样
5. finally 仅清除本用例添加的标签

## 期望结果

- 标签保存后页面与 API 一致，不覆盖其他元数据
- 无效污点不写入，取消保持原对象
- 节点关联资源与监控可读，测试不驱逐工作负载

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
