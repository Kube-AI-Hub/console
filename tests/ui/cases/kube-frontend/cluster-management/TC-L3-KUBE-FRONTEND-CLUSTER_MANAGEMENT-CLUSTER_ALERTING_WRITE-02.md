# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02 集群告警 · 内置策略恢复初始配置

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `cluster-alerting-write`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/alerting-policies`
- **需求**: `prd/kube-frontend/cluster-management/cluster-alerting-write.md`

## 产品功能

带 alerting.kubesphere.io/initial-configuration 注解的内置策略提供「恢复初始配置」：确认弹窗后把注解中的 spec 写回对象，回读与初始配置一致、启用状态不变；无注解的策略没有该入口。

### 关联需求

- `prd/kube-frontend/cluster-management/cluster-alerting-write.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-CLUSTER_ALERTING_WRITE-02** — 已知在 host 集群，当内置策略带有 `alerting.kubesphere.io/initial-configuration` 注解，则其行操作菜单提供「恢复初始配置」：确认弹窗说明会覆盖当前规则；确认后页面把注解中的 `spec` 写回对象（`PATCH .../<name>`，merge-patch；实测注解 JSON 含完整对象，dryRun 与真实写入均返回 200，回读 `spec` 与注解里的 `spec` 完全一致，随后可恢复原状），刷新列表并显示成功提示，失败显示归一后的原因；没有该注解的内置行不出现该操作；reset 不改变启用/停用状态。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../design/kube-frontend/cluster-management/cluster-alerting-write.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/cluster-alerting-write.md`](../../../../prd/kube-frontend/cluster-management/cluster-alerting-write.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 下钻一条告警，并停用平台内置策略 (Priority: P1)

作为 **集群管理员**，我希望 **点开一条告警看到它的状态、级别、所属策略、规则类型与关键标签/注解**，并能 **停用某条由平台内置策略发出的告警，或把它恢复成安装时的规则配置**，以便 **在确认误报来源后立即止血、在改坏规则后回到已知状态，而不是等平台升级或改 YAML**。

**Independent Test**：打开集群告警消息页，点第一条消息的标题，详情弹窗出现且 summary/state/severity/rule_group/rule_type/labels/annotations 各有一项非空；打开集群告警策略页内置页签，首行行操作菜单里有「启用」或「停用」，有初始配置注释的行还有「恢复初始配置」。

## 前置与配置

- 已登录，且在 host 集群
- globalrulegroups 中至少一条策略带 initial-configuration 注解，且其 spec 与注解里的 spec 一致
- 探测结论：PATCH 注解 spec 的 merge-patch 在 dryRun 与真实写入下均 200，回读 spec 与注解 spec 一致，可用 PUT 复原

## 测试步骤

1. 用 API 读取一条带注解的内置策略，快照其 spec 与 labels，并解析注解里的初始 spec
2. 打开集群告警策略页内置页签，打开该行行操作菜单，确认有「恢复初始配置」
3. 通过 API 修改规则描述，制造与初始配置的差异（便于证明 reset 生效）
4. 在页面点「恢复初始配置」，确认弹窗出现且说明会覆盖当前规则；点确认
5. 轮询 API 直到 spec 与注解初始 spec 完全一致，核对启用标签未变、页面出现成功提示
6. finally 中用 PUT 把快照 spec 与 labels 写回

## 期望结果

- 有注解的内置行有且仅有一个「恢复初始配置」入口；确认弹窗描述覆盖行为
- 确认后 spec 回到注解初始值（深比较相等），labels 不变，页面显示成功提示
- 无注解的策略不显示该入口（由 resettable=false 决定）
- 用例结束时对象已复原到快照

## 失败排查

- 没有 reset 入口：确认该策略带 initial-configuration 注解（resettable）
- {'reset 后 spec 不变：是否把注解当 PATCH body 直接发送（应只发 {spec': 'initial.spec}）'}
- 复原失败：检查 finally 的 PUT 是否带最新 resourceVersion

## 产品改版后如何更新自动化

- 页面 data-ai-id 或弹窗文案变化时同步本用例
