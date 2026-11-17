# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-12 节点添加（kubeadm join 命令）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-12`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

节点列表「添加节点」弹窗调用 ks-apiserver join-command，展示带到期时间的 kubeadm join 命令与复制按钮；后端未升级（404）时明确说明需要升级后端，403 显示无权限，其他错误可重试；命令只存在内存，不写 URL/日志。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-12** — 已知节点列表，当点击「添加节点」，则调用 `POST /kapis/resources.kubesphere.io/v1alpha3/nodes/join-command`（默认 24h，可选 ttlHours）并在弹窗展示 `kubeadm join <server> --token <token> --discovery-token-ca-cert-hash sha256:<hash>`、到期时间与复制按钮；后端 404/405 显示「当前 ks-apiserver 版本不支持节点加入，需升级后端」，403 显示无权限，其他错误保留可重试；权限检查明确拒绝 create nodes 时隐藏「添加节点」入口（检查失败 fail-open）；命令不在 URL/日志中出现，弹窗关闭即丢弃。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US8 - 不离开控制台获取新节点的加入方式 (Priority: P2)

作为 **集群管理员**，我希望 **在节点列表直接生成一条带有效期的加入命令**，以便 **新主机能加入集群，而不用自己拼 token 和 CA hash**。

**Independent Test**：有后端接口时打开弹窗看到 `kubeadm join` 命令与到期时间；后端 404 时看到明确的版本不支持说明；无权限时看到 403 原因。

## 前置与配置

- 已登录 admin；host 集群；ks-apiserver 支持 nodes/join-command（或按 404 分支验证）
- 只读用例：不执行 join，不创建节点

## 测试步骤

1. 打开节点列表，点击「添加节点」
2. 若接口 200：断言弹窗显示 kubeadm join、--token、sha256 CA hash、到期时间，复制按钮可用
3. 若接口 404：断言显示「当前 ks-apiserver 版本不支持节点加入，需升级后端」
4. 若 403：断言显示无权限；关闭弹窗命令不再可见

## 期望结果

- 命令格式：kubeadm join <server> --token <id>.<secret> --discovery-token-ca-cert-hash sha256:<hash>
- 404/403/其他错误分类显示，不统一成"加载失败"
- token 不进入 URL、不写控制台日志

## 失败排查

- 404：后端未部署本接口，需升级 ks-apiserver（见 docs/plans/node-add-backend-20261117.md）
- 401/403：确认用户有 create nodes 权限

## 产品改版后如何更新自动化

- 句柄：nodes:add、node-add:surface/command/copy/error/retry
