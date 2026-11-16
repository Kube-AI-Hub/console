# TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-09 集群概览 · 一次点击原地kubectl与取消

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-09`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `cluster-management` `overview`
- **入口**: `{BASE_URL}/kube-frontend/clusters/host/overview`
- **需求**: `prd/kube-frontend/cluster-management/overview.md`

## 产品功能

一次主动点击即准备并连接当前用户终端，原路由保留。

### 关联需求

- `prd/kube-frontend/cluster-management/overview.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CLUSTER_MANAGEMENT-OVERVIEW-10** — kubectl按钮一次点击即原地显示近全屏准备弹窗，再解析当前用户/集群工具目标并连接，不需第二次点击。关闭取消准备/释放终端、晚到响应不重开，重开重新读取目标，身份/集群变化关闭旧会话。403无重试，不创建工具Pod；直接访问原kubectl路由仍主动开启，原生键盘/ANSI/PTY/首次输出就绪保留。

### 关联设计

- 技术方案 [`design/kube-frontend/cluster-management/overview.md`](../../../../design/kube-frontend/cluster-management/overview.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/cluster-management/overview.md`](../../../../prd/kube-frontend/cluster-management/overview.md)，与用例的 `story` 对应；改需求即改这里。

### US6 - 一次点击进入 kubectl 排障 (Priority: P1)

作为 **集群管理员**，我希望 **在概览点击一次就打开当前账号终端**，以便 **不离开概览或再次点击准备按钮**。

**Independent Test**：页面打开不查询工具目标，按钮点击后原地出现准备/终端；执行只读标记，关闭释放连接，取消准备后晚到响应不重开。

## 前置与配置

- B200当前账号有工具目标与exec权限；取消和403使用明确模拟

## 测试步骤

1. 打开概览，核对没有目标查询和WebSocket
2. 点击一次，核对页面不跳转，终端接收真实输出
3. 执行唯一标记和只读版本命令，关闭释放
4. 重新打开重新解析，准备时取消，核对不会晚到重开
5. 模拟403，核对无重试且可关闭

## 期望结果

- 无二次准备按钮，原生终端与近全屏交互保留
- 关闭取消请求并销毁连接，403不绕权限，不创建Pod

## 失败排查

- 先看 `tests/ui/artifacts/` 下的截图与日志

## 产品改版后如何更新自动化

- 步骤文案改 `specs/`；选择器改 `pages/`
