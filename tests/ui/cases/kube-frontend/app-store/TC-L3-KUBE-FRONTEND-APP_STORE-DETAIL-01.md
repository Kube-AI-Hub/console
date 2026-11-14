# TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01 应用详情 · 从卡片进入、版本表与 Readme、只读安装入口

- **用例 ID**: `TC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `app-store` `detail`
- **入口**: `{BASE_URL}/kube-frontend/apps`
- **需求**: `prd/kube-frontend/app-store/detail.md`

## 产品功能

商店卡片进入详情；应用名/图标或占位/分类/简介来自详情接口；版本表行数等于版本接口 items 数、类型取自应用 app_version_types；Readme 折叠，展开后显示 README.md 解码文本；安装/部署按钮禁用且不发起写请求；未知 appId 显示 not-found。

### 关联需求

- `prd/kube-frontend/app-store/detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/app-store/detail.md`](../../../../prd/kube-frontend/app-store/detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-APP_STORE-DETAIL-01** — 已知商店里有应用，当在 /kube-frontend/apps 点击一张应用卡片，则进入 /kube-frontend/apps/<appId>，页面显示应用名、图标或首字母占位、分类、简介；版本表逐行显示版本号、类型（取自应用的 app_version_types，因为版本对象没有 type 字段）、创建时间与状态，行数等于版本接口的 items 数；Readme 默认折叠，展开后显示该版本 README.md 解码后的纯文本（没有 README 时回退到应用描述）；安装/部署按钮处于禁用状态并说明写操作下一轮开放，点击不发请求；当 appId 不存在或应用已下架，则显示「应用不存在」的空状态与返回入口，而不是空白或重试按钮；页面不提供任何写操作。

### 关联设计

- 技术方案 [`design/kube-frontend/app-store/detail.md`](../../../../design/kube-frontend/app-store/detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/app-store/detail.md`](../../../../prd/kube-frontend/app-store/detail.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 判断这个应用是否值得安装 (Priority: P1)

作为 **平台用户**，我希望 **从应用卡片进入详情，看到应用的分类、简介、版本历史和 README**，以便 **在安装之前判断它的用途、当前可用的版本，以及安装它需要什么**。

**Independent Test**：从 /kube-frontend/apps 点击一张卡片，详情页出现应用名与分类；版本表行数等于 /apps/<id>/versions 的 items 数；展开 Readme 后出现该版本 README.md 的文本；安装按钮禁用并给出原因。

## 前置与配置

- 已登录，openpitrix 模块开启，商店至少有 1 个应用
- 选中的应用至少有 1 个版本

## 测试步骤

1. 用 API 读取应用列表，取第一个应用及其版本数
2. 打开 /kube-frontend/apps，点击该应用的卡片（app-store:card:<appId>）
3. 核对 URL、app-detail:surface、应用名
4. 核对版本表行数等于版本接口 items 数，首行版本号在表中
5. 核对安装/部署按钮 disabled，点击不发请求
6. 展开 Readme，核对出现非空纯文本
7. 打开 /kube-frontend/apps/app-does-not-exist，核对 app-detail:not-found 且没有重试按钮
8. 汇总页面产生的 openpitrix 写请求，断言为空

## 期望结果

- 卡片进入 /kube-frontend/apps/<appId>，详情 ready，应用名与接口一致
- 版本表行数 = 版本接口 items 数；版本类型列显示应用级类型（helm）
- Readme 展开后文本非空且不是 base64
- 安装按钮 disabled；详情页不产生 POST/PUT/PATCH/DELETE 到 openpitrix
- 未知 appId → 应用不存在空状态（无重试按钮）

## 失败排查

- 卡片点不动：确认卡片链接带 app-store:card:<id> 且 href 正确
- 版本表行数不符：检查版本接口信封是 {items,total_count}
- Readme 为空：确认读的是 files["README.md"] 并做 base64 解码
- 安装按钮可点：本轮必须 disabled 且不发请求

## 产品改版后如何更新自动化

- 页面句柄或数据字段变化时同步本用例
