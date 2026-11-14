# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05 节点列表与详情 · 打开交互终端

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `nodes`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/nodes`
- **需求**: `prd/kube-frontend/cluster-management/nodes.md`

## 产品功能

从节点列表和详情连接真实节点 shell，近全屏使用并关闭会话。

### 关联需求

- `prd/kube-frontend/cluster-management/nodes.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-NODES-05** — Ready 节点在列表行操作和详情提供「打开终端」，点击立即显示近全屏弹窗；真正收到远端输出后才启用输入。支持原始 ANSI、光标、Tab、历史和控制键，Esc 不关闭弹窗；1024/1280/1600 视口同步远端 PTY 行列，关闭或离开页面释放连接；无权限、启动失败、等待超时明确报错且可重连。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/nodes.md`](../../../../design/kube-frontend/cluster-management/nodes.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/nodes.md`](../../../../prd/kube-frontend/cluster-management/nodes.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 在目标节点直接排障 (Priority: P1)

作为 **有节点终端权限的管理员**，我希望 **从列表或详情打开节点 shell**，以便 **使用原生交互命令定位主机问题**。

**Independent Test**：连接后执行 hostname 与唯一 printf 标记，验证输出来自目标节点，调整视口后核对 stty size，关闭会话。

## 前置与配置

- 当前账号有 nodes/exec 权限且集群有 Ready 节点
- 节点有交互式 shell，支持路径补全与 stty

## 测试步骤

1. 分别从列表行菜单和详情入口打开终端
2. 执行唯一标记与 hostname，核对远端输出
3. 使用 Tab 补全路径，按 Esc 核对弹窗不关闭
4. 在三档视口核对弹窗大小与远端 stty 行列
5. 关闭弹窗，核对 WebSocket 已关闭

## 期望结果

- 输出来自目标节点而非其他工具容器
- Tab 不移动焦点，PTY 尺寸同步，Esc 留给终端程序
- 关闭后不保留浏览器节点会话

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
