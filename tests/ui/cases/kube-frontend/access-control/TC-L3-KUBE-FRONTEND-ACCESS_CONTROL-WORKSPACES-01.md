# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01 企业空间 · 列表四列

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `workspaces`
- **入口**: `{BASE_URL}/kube-frontend/access/workspaces`
- **需求**: `prd/kube-frontend/access-control/workspaces.md`

## 产品功能

['企', '业', '空', '间', None, '·', None, '列', '表', '四', '列', '：', '列', '集', '合', '与', '老', None, 'c', 'o', 'n', 's', 'o', 'l', 'e', None, '一', '致', '。']

### 关联需求

- `prd/kube-frontend/access-control/workspaces.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/workspaces.md`](../../../../prd/kube-frontend/access-control/workspaces.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-WORKSPACES-01** — 已知平台上有企业空间，当打开企业空间页，则显示名称、状态、集群、创建时间四列。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/workspaces.md`](../../../../design/kube-frontend/access-control/workspaces.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/workspaces.md`](../../../../prd/kube-frontend/access-control/workspaces.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 看清平台上有哪些企业空间 (Priority: P1)

作为 **平台管理员**，我希望 **看到企业空间状态与集群关联**，以便 **确认归属**。

**Independent Test**：打开企业空间页，核对名称集合与 `kubectl get workspaces` 一致。

## 前置与配置

- 已登录，且有平台权限
- 该页至少有一条数据（用例先用 API 确认）

## 测试步骤

1. 打开该页
2. 核对表头
3. 读取第一行

## 期望结果

- 表头依次为 ["名称", "状态", "集群", "创建时间"]
- 第一行有内容

## 失败排查

- 缺列时看 PlatformListPage 的 columns
- 空列表时用例 skip 而不是失败

## 产品改版后如何更新自动化

- 列变化时改 pages/access_control.py
