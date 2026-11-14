# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01 kubectl · 当前账号连接与只读命令

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `kubectl`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/kubectl`
- **需求**: `prd/kube-frontend/cluster-management/kubectl.md`

## 产品功能

当前账号连接已有工具容器，执行只读命令并关闭会话。

### 关联需求

- `prd/kube-frontend/cluster-management/kubectl.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/kubectl.md`](../../../../prd/kube-frontend/cluster-management/kubectl.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-01** — 集群侧栏可进入 kubectl；点击连接后在近全屏独立弹窗查询当前账号工具 Pod，再连接 PTY。关闭及离开页面释放连接，返回页面不自动连接；未部署或未就绪不创建替代 Pod，错误明确可见。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/kubectl.md`](../../../../design/kube-frontend/cluster-management/kubectl.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/kubectl.md`](../../../../prd/kube-frontend/cluster-management/kubectl.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在浏览器执行集群命令 (Priority: P1)

作为 **集群管理员**，我希望 **连接自己的工具容器执行 kubectl**，以便 **无需下载配置即可进行运维**。

**Independent Test**：点击连接，执行唯一标记的只读命令并读取结果；关闭后输入禁用且会话销毁。

## 前置与配置

- 已登录的集群管理员账号有就绪 kubectl 工具 Pod 和 exec 权限

## 测试步骤

1. 打开工具页并核对未点击前不出现会话
2. 点击连接等待就绪
3. 执行唯一标记与 kubectl 只读版本命令，核对输出
4. 关闭并离开页面，再返回核对未自动连接

## 期望结果

- 输出包含唯一标记与客户端版本信息
- 关闭后会话不存在，再返回页面仍需主动连接
- 测试不创建或删除工具 Pod，不执行资源写入命令

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
