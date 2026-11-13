# TC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01 平台设置 · 两页签切换且无项目工作区栏

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `platform-settings` `page`
- **入口**: `{BASE_URL}/kube-frontend/settings/info`
- **需求**: `prd/kube-frontend/platform-settings/_index.md`

## 产品功能

['平', '台', '信', '息', '与', '通', '知', '渠', '道', '在', '客', '户', '端', '切', '换', '，', '且', '不', '出', '现', '项', '目', '工', '作', '区', '栏', '。']

### 关联需求

- `prd/kube-frontend/platform-settings/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/_index.md`](../../../../prd/kube-frontend/platform-settings/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-PLATFORM_SETTINGS-01** — 已知已登录且有平台权限，当在两个页签之间切换，则每次都显示对应内容，页签高亮跟随，切换不产生文档请求，且不出现项目工作区栏。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/_index.md`](../../../../design/kube-frontend/platform-settings/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/_index.md`](../../../../prd/kube-frontend/platform-settings/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认平台自称与通知渠道状态 (Priority: P1)

作为 **平台管理员**，我希望 **一眼看到平台名称、控制台地址与各通知渠道是否可用**，以便 **在告警发不出去时先排除渠道未配置**。

**Independent Test**：打开通知渠道页，核对五个渠道的徽标与平台 Secret 是否存在一致。

## 前置与配置

- 已登录，且有平台权限

## 测试步骤

1. 打开平台信息页
2. 确认没有项目工作区栏
3. 切到通知渠道再切回
4. 统计切换期间的文档请求

## 期望结果

- 两页各自显示内容
- 页面不出现 workspace-bar
- 页签高亮跟随
- 切换期间文档请求为 0

## 失败排查

- 出现工作区栏说明平台页复用了项目布局

## 产品改版后如何更新自动化

- 布局变化时改 routes/kube-frontend.settings/route.tsx
