# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-10 企业空间用户组 · 实时刷新（watch）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-10`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/{KA_WORKSPACE}/user-groups`
- **需求**: `prd/kube-frontend/access-control/workspace-user-groups.md`

## 产品功能

用户组页同时 watch groups 与 groupbindings；另一处创建/删除部门或改成员绑定后，树与成员数自动更新，无需点刷新；页面显示实时刷新状态，断开时显示「已断开，可手动刷新」，手动刷新保留。

### 关联需求

- `prd/kube-frontend/access-control/workspace-user-groups.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-10** — 已知用户组页保持打开，当另一处创建/重命名/删除该空间的用户组后，本页无需手动刷新即在数秒内更新树；页面显示实时刷新状态（连接中/已开启/已断开），已断开时显示「实时刷新已断开，可手动刷新」，手动刷新按钮仍可用。仅成员绑定变化时，若该部署的 groupbindings 集合不提供 watch（mlu370 实测不投递事件），则成员数在手动刷新后更新，页面不得静默假装实时或改用轮询。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-user-groups.md`](../../../../design/kube-frontend/access-control/workspace-user-groups.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-user-groups.md`](../../../../prd/kube-frontend/access-control/workspace-user-groups.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 与他人同时维护部门树时看到别人的改动 (Priority: P2)

作为 **租户(企业空间)管理员**，我希望 **在页面打开期间，其他管理员创建/改名/删除用户组或调整成员后，本页自动更新**，以便 **不会基于过期树继续编辑而互相覆盖**。

**Independent Test**：保持用户组页打开，用 API 在另一处创建一个唯一用户组 → 树在数秒内出现该节点（未点刷新）；再删除该组 → 节点自动消失；页面显示实时刷新状态，断开时显示「实时刷新已断开」且手动刷新仍可用。

## 前置与配置

- 已登录，且在 host 集群；企业空间 system-workspace 可写用户组
- 用例自建唯一用户组（generateName）并在结束后删除（含 groupbinding）

## 测试步骤

1. 打开用户组页，等待 surface 就绪；读取 live-state，等待其离开 connecting
2. 用 API 在另一处创建唯一用户组（不点页面刷新），观察树节点是否出现
3. 用 API 为该组创建 groupbinding（admin）；本部署 groupbindings 无 watch，点页面「刷新」后节点成员数变为 1（登记部署限制，不用轮询掩盖）
4. 用 API 删除该组，观察节点是否自动消失（组变更全程不点刷新）
5. 最后确认手动刷新按钮仍在

## 期望结果

- live-state 为 live（若通道不可用则为 error 且显示「实时刷新已断开」；本用例要求 live 时自动更新，error 时按环境阻塞记录而不是静默）
- 外部创建后数秒内树出现节点；外部删除后数秒内节点消失（组变更未点刷新）
- 仅成员绑定变化：手动刷新后成员数更新；页面不冒充实时（live-state 只由 groups watch 驱动）
- 页面未发生整页错误，手动刷新可用

## 失败排查

- 节点不出现：确认 watch 同时订阅 groups（只订阅 groupbindings 收不到创建事件）
- live-state 长期 connecting：确认 BFF 流式代理支持 /kapis/... watch；回退为手动刷新并登记环境阻塞
- 节点出现但成员数不变：确认 groupbindings watch 也建立，且 invalidate 的是 ['workspace-user-groups', ws] 前缀

## 产品改版后如何更新自动化

- 句柄：workspace-user-groups:live-state（data-ai-state）、tree-node、data-ai-generate-name、refresh
