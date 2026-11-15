# TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12 镜像构建器 · 状态与视觉基线（加载/空/错误/权限/英文）

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-workloads` `s2ibuilder`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/s2ibuilder`
- **需求**: `prd/kube-frontend/app-workloads/s2ibuilder.md`

## 产品功能

列表的五种画面分开：加载中、真实空、无匹配、失败、无权限；403 显示权限原因且不提供重试；英文界面文案完整；三档宽度下表头与行内容可读。

### 关联需求

- `prd/kube-frontend/app-workloads/s2ibuilder.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_WORKLOADS-S2IBUILDER-12** — 状态与视觉：加载/真实空/无匹配/失败/无权限五态分开，不互相顶替；403 显示无权限原因且不提供重试，500 提供重试；surface 始终声明 `data-ai-state`（loading/ready/empty/error）且页面动作有稳定 `data-ai-id`；中英文键完整（英文显示 Name/Status/Created 等，不出现原始 key）；1024/1280/1600 三档宽度下表头与行内容不溢出、主题 token 对比度可读。

### 关联设计

- 技术方案 [`design/kube-frontend/app-workloads/s2ibuilder.md`](../../../../design/kube-frontend/app-workloads/s2ibuilder.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-workloads/s2ibuilder.md`](../../../../prd/kube-frontend/app-workloads/s2ibuilder.md)，与用例的 `story` 对应；改需求即改这里。

### US5 - 状态、权限与语言/主题不退化 (Priority: P2)

作为 **不同权限与语言的读者**，我希望 **加载、空、失败、无权限是分开的画面，英文界面完整，三档宽度下可读**，以便 **在任何环境下都能判断页面是否正常**。

**Independent Test**：空列表显示空态；500 显示错误与重试；403 显示无权限且不提供重试；英文界面显示英文表头；surface 始终声明 data-ai-state。

## 前置与配置

- 已登录
- 可在浏览器路由层拦截列表响应（模拟）

## 测试步骤

1. 拦截 kapis 列表返回空 items → 打开列表，断言 empty 状态与空态文案
2. 拦截列表返回 500 → 断言 error 状态、错误面板与重试按钮
3. 拦截列表返回 403 → 断言无权限文案且没有重试按钮
4. 以 localStorage kube-frontend-locale=en 打开列表，断言英文表头

## 期望结果

- 空态/失败/无权限是三种不同画面，不互相顶替
- 500 提供重试；403 不提供重试并说明没有权限
- 英文界面显示 Name/Status 等英文表头，不出现原始 key
- surface 始终声明 data-ai-state（loading/ready/empty/error 之一）

## 失败排查

- 拦截未命中：路由 glob 与 kapis 路径
- 403 仍显示重试：retry 分支条件
- 英文缺键：zh/en 键集合是否一致

## 产品改版后如何更新自动化

- 页面句柄或字段映射变化时同步本用例
