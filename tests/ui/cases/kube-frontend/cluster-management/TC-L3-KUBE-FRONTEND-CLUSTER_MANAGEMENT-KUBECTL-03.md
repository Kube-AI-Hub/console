# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-03 kubectl · Tab 补全与 shell 编辑快捷键

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-03`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `kubectl`
- **入口**: `{BASE_URL}/kube-frontend/clusters/{cluster}/kubectl`
- **需求**: `prd/kube-frontend/cluster-management/kubectl.md`

## 产品功能

原样传递终端按键，由交互式 shell 提供补全、历史和行内编辑。

### 关联需求

- `prd/kube-frontend/cluster-management/kubectl.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/kubectl.md`](../../../../prd/kube-frontend/cluster-management/kubectl.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-KUBECTL-03** — Tab 原样发送给远端，不移走终端焦点；支持目标 shell 的命令和路径补全、上下键历史及 Ctrl+A/E/U 行内编辑。默认优先交互式 bash，未安装时回退交互式 sh；高级补全依赖目标 shell 和已配置的补全脚本。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/kubectl.md`](../../../../design/kube-frontend/cluster-management/kubectl.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/kubectl.md`](../../../../prd/kube-frontend/cluster-management/kubectl.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在浏览器执行集群命令 (Priority: P1)

作为 **集群管理员**，我希望 **连接自己的工具容器执行 kubectl**，以便 **无需下载配置即可进行运维**。

**Independent Test**：点击连接，执行唯一标记的只读命令并读取结果；关闭后输入禁用且会话销毁。

## 前置与配置

- 当前账号有就绪工具容器及 exec 权限
- 目标 shell 支持命令与路径补全，容器有 kubectl 和 /bin 目录

## 测试步骤

1. 输入 kubect 并按 Tab，确认焦点仍在终端，再执行客户端版本查询
2. 输入路径前缀 /bi 并按 Tab，执行 printf，核对实际输出为 /bin/
3. 按上箭头及回车，核对同一命令再次执行
4. 使用 Ctrl+U 清空输入，Ctrl+A/E 在行首插入 printf，核对输出

## 期望结果

- 补全由远端生成，Tab 不跳到弹窗按钮
- 补全后命令可运行，路径结果与历史执行次数正确
- 控制键不移走 DOM 焦点，行内编辑位置正确

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 键盘输入目标为终端输出区的 xterm-helper-textarea
