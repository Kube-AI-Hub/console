# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07 企业空间概览 · 资源用量与项目用量排行

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspace-console`
- **入口**: `{BASE_URL}/kube-frontend/workspaces/system-workspace/overview`
- **需求**: `prd/kube-frontend/access-control/workspace-console.md`

## 产品功能

企业空间概览显示空间级资源用量（CPU/内存/容器组/网络收发）与项目用量排行 Top 5（CPU/内存页签），缺失指标显示 - 而不是 0。

### 关联需求

- `prd/kube-frontend/access-control/workspace-console.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspace-console.md`](../../../../prd/kube-frontend/access-control/workspace-console.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACE_CONSOLE-07** — 已知企业空间 `<ws>` 的监控上报了空间级指标，当打开空间控制台概览页，则「资源用量」区块显示 CPU、内存、容器组数量与网络收发（收/发分别以字节单位呈现），缺失的指标显示 `-` 而不是 0；监控不可用时显示说明而不是数字；「项目用量排行（Top 5）」区块按 CPU 与内存两个页签列出该空间内用量最高的 5 个项目（序号、名称、数值），名称链接到该项目的控制台概览页，排行只包含 `workspace` 标签等于本空间的样本；排行无数据时显示空态说明。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspace-console.md`](../../../../design/kube-frontend/access-control/workspace-console.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspace-console.md`](../../../../prd/kube-frontend/access-control/workspace-console.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 企业空间管理员看自己的空间 (Priority: P1)

作为 **企业空间管理员**，我希望 **在一个地方看到这个空间的概览、项目和成员**，以便 **不必绕到平台访问控制里逐项查**。

**Independent Test**：打开 `/workspaces/<ws>/overview`，核对标题是空间别名或名称、项目数与成员数与接口一致；侧栏出现「概览 / 项目 / 企业空间成员」三项。

## 前置与配置

- 已登录；system-workspace 的监控有空间级采样

## 测试步骤

1. 通过 API 读 `/kapis/monitoring.kubesphere.io/v1alpha3/workspaces/<ws>` 取期望用量
2. 打开企业空间概览，核对「资源用量」四项数值与 API 一致
3. 核对「项目用量排行」默认 CPU 页签 ≤5 行且每行名称属于该空间
4. 切到内存页签，核对数值带字节单位

## 期望结果

- 资源用量区块 workspace-overview:usage 存在，四项分别有句柄 :usage:cpu/:memory/:pods/:network
- CPU 数值等于 API 的 workspace_cpu_usage（保留一位小数以内），容器组为整数
- 排行行数 ≤5，名称链接形如 /kube-frontend/<ws>/projects/<ns>/overview
- 排行只含 workspace 标签等于本空间的样本（用例用 API 交叉核对）

## 失败排查

- 排行里出现别的空间的命名空间：没按 workspace 标签过滤
- 用量显示 0：把缺失指标当成了 0

## 产品改版后如何更新自动化

- 句柄：workspace-overview:usage / :usage:cpu / :usage:memory / :usage:pods / :usage:network / :ranking / :ranking:tab:{cpu,memory} / :ranking:list / :ranking:empty
