# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04 添加集群 · 名称已存在时提前提示且不阻止提交

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `add-cluster`
- **入口**: `{BASE_URL}/kube-frontend/clusters`
- **需求**: `prd/kube-frontend/cluster-management/add-cluster.md`

## 产品功能

名称字段失焦时向平台确认是否已被占用，命中则提示；该提示只是提前告知，提交仍由服务端裁决。

### 关联需求

- `prd/kube-frontend/cluster-management/add-cluster.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-ADD_CLUSTER-04** — 已知平台已存在名为 `host` 的集群，当在「集群名称」中输入 `host` 并使该字段失焦，则字段下方出现「已经有同名集群」的提示；修改名称后提示消失；该提示**不阻止提交**，创建请求仍会发出并由服务端裁决。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/add-cluster.md`](../../../../design/kube-frontend/cluster-management/add-cluster.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/add-cluster.md`](../../../../prd/kube-frontend/cluster-management/add-cluster.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 把已有集群接入平台 (Priority: P1)

作为 **平台管理员**，我希望 **在集群列表里粘贴成员集群的 kubeconfig 完成接入**，以便 **在不离开控制台的情况下把新集群纳入管理**。

**Independent Test**：在集群列表点「添加集群」，填入名称与 kubeconfig 并确认；列表中应出现该集群，且集群对象中存在 base64 编码的 kubeconfig。

## 前置与配置

- 已登录，且有平台管理权限
- 平台里已存在名为 host 的集群

## 测试步骤

1. 打开集群列表，点「添加集群」
2. 在「集群名称」输入 host，然后让该字段失焦
3. 观察字段下方的提示
4. 把名称改成另一个合法且未被占用的名字，再次失焦
5. 观察提示是否消失

## 期望结果

- 第二步后出现「已经有同名集群了，请换一个名称。」，元素句柄 clusters:add-name-error
- 该提示出现时提交按钮仍可用（不因预检结果禁用）
- 第四步后提示消失
- 预检只发一次 GET（带 x-check-exist 头），不随输入逐字请求

## 失败排查

- {'提示不出现：确认请求带 x-check-exist': 'true，且返回 200 {"exist":true}'}
- 提示把可用名字也判为占用：该端点对不存在的名字返回 200 {"exist":false}，不是 404

## 产品改版后如何更新自动化

- 句柄变化时改 pages/cluster_fleet.py 与用例断言
