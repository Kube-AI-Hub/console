# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-04 切换集群 · 别名在整页刷新后保持

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-switch`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/cluster-switch.md`

## 产品功能

侧栏切换器在整页刷新前后显示同一个标签，不因刷新从别名退回集群名。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-switch.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_SWITCH-04** — 切换器触发按钮的文字在整页刷新后保持刷新前的展示：有别名时为「别名」+ 下一行「集群名 · 当前集群」，无别名时为集群名；不因刷新而从别名退回集群名。别名按用户与集群分别记忆，别名被修改后下一次加载使用新值。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-switch.md`](../../../../design/kube-frontend/cluster-management/cluster-switch.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-switch.md`](../../../../prd/kube-frontend/cluster-management/cluster-switch.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在集群之间直接切换 (Priority: P1)

作为 **平台管理员**，我希望 **在集群控制台里直接切到另一个集群**，以便 **比较或处理多个集群而不必回到列表重新找**。

**Independent Test**：在 `host` 概览点击侧栏顶部切换器，选择另一个集群；地址变为该集群的概览，切换器显示新集群名；再切回 `host`。

## 前置与配置

- 已登录，且有平台管理权限
- 当前集群带 kubesphere.io/alias-name 注解

## 测试步骤

1. 打开该集群概览，读取切换器文字（别名与集群名两行）
2. 整页重新加载同一地址
3. 再次读取切换器文字
4. 清空该集群别名后重新加载

## 期望结果

- 刷新前与刷新后切换器文字一致：第一行别名，第二行「集群名 · 当前集群」
- 别名被清空后下一次加载显示集群名，不残留旧别名

## 失败排查

- 刷新后变回集群名：确认集群列表已随外壳加载，且别名记忆键含用户名
- 残留旧别名：别名清空时要删除记忆键，而不是写入空串

## 产品改版后如何更新自动化

- 选择器变化时改 pages/cluster_fleet.py 的 switcher_current
