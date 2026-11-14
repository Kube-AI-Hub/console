# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-02 kubectl · ANSI 与 vim 光标交互

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `kubectl`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/kubectl`
- **需求**: `prd/kube-frontend/cluster-management/kubectl.md`

## 产品功能

近全屏终端保留格式、光标与备用屏幕，并将键盘直接送入远端程序。

### 关联需求

- `prd/kube-frontend/cluster-management/kubectl.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/kubectl.md`](../../../../prd/kube-frontend/cluster-management/kubectl.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-02** — 交互终端保留 ANSI 色彩、光标与备用屏幕。目标有 vim/vi 时可进入编辑器，用方向键移动光标并插入字符；Esc 不关闭弹窗，退出编辑器恢复 shell；窗口尺寸同步远端行列，滚动历史上限 5000 行。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/kubectl.md`](../../../../design/kube-frontend/cluster-management/kubectl.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/kubectl.md`](../../../../prd/kube-frontend/cluster-management/kubectl.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在浏览器执行集群命令 (Priority: P1)

作为 **集群管理员**，我希望 **连接自己的工具容器执行 kubectl**，以便 **无需下载配置即可进行运维**。

**Independent Test**：点击连接，执行唯一标记的只读命令并读取结果；关闭后输入禁用且会话销毁。

## 前置与配置

- 当前账号有就绪工具容器及 exec 权限
- 工具容器已安装 vim 或 vi，不在测试中安装软件

## 测试步骤

1. 连接工具终端，输出红色标记，核对渲染颜色
2. 探测 vim 或 vi，打开无文件编辑器，插入文本
3. 用方向键移动光标并插入字符，按 Esc，确认弹窗仍在
4. 不保存退出编辑器，核对 shell 屏幕恢复且可继续输入命令

## 期望结果

- ANSI 色彩与普通文字不同
- 光标移动后字符插入位置正确，Esc 不关闭弹窗
- 编辑器退出后恢复主屏幕，无测试文件写入

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 输入目标使用 xterm-helper-textarea，状态句柄见 cluster_management.py
