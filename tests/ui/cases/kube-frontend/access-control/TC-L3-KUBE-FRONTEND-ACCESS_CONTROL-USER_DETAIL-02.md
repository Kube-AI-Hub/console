# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02 用户详情 · 登录历史分页与四列

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `user-detail`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/user-detail.md`

## 产品功能

登录历史按页展示时间、状态、来源 IP、原因；总数取 totalItems；翻页后行身份变化且总数不变；缺失 success 不显示为失败。

### 关联需求

- `prd/kube-frontend/access-control/user-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/user-detail.md`](../../../../prd/kube-frontend/access-control/user-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-02** — 已知某用户 `/loginrecords` 的 `totalItems` 大于 10，当打开其详情，则登录历史表列为时间、状态、来源 IP、原因，当前页行数等于接口 `items` 数，标题旁显示「共 {totalItems} 条」；状态对 `spec.success===true` 显示成功、`false` 显示失败、字段缺失显示 `-` 而不是失败或 0；来源 IP 取 `spec.sourceIP`，缺失显示 `-`；点下一页后请求 `page=2`，行身份与第一页不同且总数不变；`totalItems` 不大于 10 时不出现分页控件。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/user-detail.md`](../../../../design/kube-frontend/access-control/user-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/user-detail.md`](../../../../prd/kube-frontend/access-control/user-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US2 - 翻看完整登录历史 (Priority: P1)

作为 **平台管理员**，我希望 **登录历史按页翻看，并看到每次登录成功还是失败、从哪个 IP 来**，以便 **核对异常登录，而不是只看到最近 10 条时间戳**。

**Independent Test**：打开一个登录次数超过 10 的账号详情，核对该页行数、`totalItems`、时间/状态/来源 IP/原因四列；点下一页后行与第一页不同且总数不变。

## 前置与配置

- 已登录平台管理
- 选用 loginrecords.totalItems 大于 10 的用户（优先 admin）

## 测试步骤

1. 用 API 读取 page=1 与 page=2 的 loginrecords
2. 打开该用户详情，核对本页行数、共 N 条、四列表头
3. 点下一页，核对其行与第一页不同且总数不变

## 期望结果

- 标题旁总数等于接口 totalItems
- 当前页行数等于该页 items
- 表头含时间、状态、来源 IP、原因
- 第二页首行与第一页不同

## 失败排查

- 总数等于 10：读的仍是固定 limit 且丢掉了 totalItems
- 两页相同：page 参数未下发
- 失败列把无 success 的行标红：把缺失当成了 false

## 产品改版后如何更新自动化

- 选择器见 LoginHistoryPanel.tsx 的 user-detail:logins / user-detail:login-list
