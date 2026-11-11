# TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-05 配置字典 · 键列截断到 50 个字符

- **用例 ID**: `TC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-05`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `configmaps` `list`
- **入口**: `{BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps`
- **需求**: `prd/kube-frontend/configmaps/list.md`

## 产品功能

键列最多显示 50 个字符，超出以 `...` 结尾，完整键名经悬停提示可读；未超长时原样显示。

### 关联需求

- `prd/kube-frontend/configmaps/list.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-CONFIGMAPS-LIST-05** — Given 某条 ConfigMap 的键名拼接后超过 50 个字符，When 查看列表，Then 键列只显示前 50 个字符并以 `...` 结尾，鼠标悬停时展示完整键名；拼接不超过 50 个字符时原样显示且不带省略号。

### 关联设计

- 技术方案 [`design/kube-frontend/configmaps/list.md`](../../../../design/kube-frontend/configmaps/list.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/configmaps/list.md`](../../../../prd/kube-frontend/configmaps/list.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 作为项目成员，看清每条配置包含哪些键


**Independent Test**：列表「键」列以逗号（无空格）分隔显示键名，最多 50 个字符，超出部分以 `...` 结尾；完整键名在悬停提示与详情页可见；无键时显示 `-`。

## 前置与配置

- 已登录
- 当前项目内同时存在「键名拼接超过 50 个字符」与「键名很短」的 ConfigMap

## 测试步骤

1. 打开 {BASE_URL}/kube-frontend/system-workspace/clusters/host/projects/default/configmaps
2. 找到键名很多的那条 ConfigMap，读取其「键」列文本
3. 悬停该单元格，读取提示文本
4. 读取另一条短键名 ConfigMap 的「键」列文本

## 期望结果

- 超长单元格文本为前 50 个字符加 `...`，共 53 个字符
- 提示文本为完整的合键名，长度大于 50
- 短键名单元格原样显示，不带省略号，且没有提示
- 该行高度与其他行一致（未被撑成多行）

## 失败排查

- 显示 53 个以上字符时检查是否漏了 `Array.from` 的码点计数
- 单元格多行时可能被改回了 wrap 渲染，见 DEC-LIST-03

## 产品改版后如何更新自动化

- 阈值变更时同步本文件的 50 与 KEYS_PREVIEW_LENGTH
