# TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01 平台信息 · 三行属性

- **用例 ID**: `TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `platform-settings` `info`
- **入口**: `{BASE_URL}/kube-frontend/settings/info`
- **需求**: `prd/kube-frontend/platform-settings/info.md`

## 产品功能

['平', '台', '信', '息', '页', '显', '示', '平', '台', '名', '称', '、', '平', '台', '描', '述', '、', '控', '制', '台', '地', '址', '三', '行', '，', '缺', '失', '时', '显', '示', None, [None], '。']

### 关联需求

- `prd/kube-frontend/platform-settings/info.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/platform-settings/info.md`](../../../../prd/kube-frontend/platform-settings/info.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-INFO-01** — 已知平台配置可读，当打开平台信息页，则显示平台名称、平台描述、控制台地址三行；配置中缺少 `console` 段时三行显示 `-`。

### 关联设计

- 技术方案 [`design/kube-frontend/platform-settings/info.md`](../../../../design/kube-frontend/platform-settings/info.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/platform-settings/info.md`](../../../../prd/kube-frontend/platform-settings/info.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 确认平台自称与控制台地址 (Priority: P1)

作为 **平台管理员**，我希望 **看到平台名称与控制台地址**，以便 **在分享链接或排查域名问题时有所依据**。

**Independent Test**：打开平台信息页，核对三行与 `kubesphere-config` 中 `console` 段的值一致。

## 前置与配置

- 已登录，且有平台权限
- 平台配置 kubesphere-config 可读

## 测试步骤

1. 打开平台信息页
2. 核对属性名
3. 读取三个值

## 期望结果

- 属性名依次为 平台名称、平台描述、控制台地址
- 值为 - 或非空字符串

## 失败排查

- 三行都为空说明没有 console 段（属正常），看页面是否显示 - 而不是空白

## 产品改版后如何更新自动化

- 属性变化时改 pages/platform_settings.py
