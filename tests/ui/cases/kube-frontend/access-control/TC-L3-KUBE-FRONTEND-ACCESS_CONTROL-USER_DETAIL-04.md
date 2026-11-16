# TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04 用户详情 · 登录记录在登录写入时按用户裁剪

- **用例 ID**: `TC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04`
- **级别**: L3  **套件**: `point`
- **模块**: `kube-frontend` / `access-control` `user-detail`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/user-detail.md`

## 产品功能

登录写入后按当前用户裁剪超额与过期记录，并推进 lastLoginTime；只影响本人，清理失败不影响登录。

### 关联需求

- `prd/kube-frontend/access-control/user-detail.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/user-detail.md`](../../../../prd/kube-frontend/access-control/user-detail.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-04** — 已知某用户已积累 `loginHistoryMaximumEntries`（默认 200）条以上登录记录，当该用户再次登录成功，则该用户的 `LoginRecord` 总数回落到上限以内，保留的是时间最新的若干条；`/users/<名>/loginrecords` 的 `totalItems` 不超过上限。清理在登录写入后同步完成，不依赖后台控制器。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-05** — 已知某用户有早于 `loginHistoryRetentionPeriod` 的登录记录，当该用户再次登录成功，则这些过期记录被删除，未过期的记录不受影响；清理只作用于当前登录的用户，其他用户的记录条数不变。
- **AC-L3-KUBE-FRONTEND-ACCESS_CONTROL-USER_DETAIL-06** — 已知用户登录成功，当登录记录写入后，则该用户的 `status.lastLoginTime` 更新为本次登录时间；并发或重复登录时该字段只前进不后退；若登录记录清理失败，登录本身仍然成功（返回 token），失败只记录日志。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/user-detail.md`](../../../../design/kube-frontend/access-control/user-detail.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/user-detail.md`](../../../../prd/kube-frontend/access-control/user-detail.md)，与用例的 `story` 对应；改需求即改这里。

### US4 - 登录历史不会无限增长 (Priority: P2)

作为 **平台运维**，我希望 **每个用户的登录历史自动收敛到配置的上限与保留期以内**，以便 **登录记录不会随着时间累积成几万条拖慢控制面组件**。

**Independent Test**：把某用户造到超过上限条数的记录，再触发一次该用户登录，确认记录数回落到上限以内且保留最新若干条；另一用户的条数不变。

## 前置与配置

- 已登录平台管理
- 可读取 authentication.loginHistoryMaximumEntries 与 loginHistoryRetentionPeriod
- 有一个可重复登录的测试账号，且平台上存在另一个账号作为对照

## 测试步骤

1. 用 API 记录对照账号当前的 loginrecords totalItems
2. 把测试账号造到超过 loginHistoryMaximumEntries 条记录
3. 触发该测试账号一次成功登录
4. 用 API 直查测试账号的 loginrecords totalItems 与最新若干条时间
5. 读取测试账号的 status.lastLoginTime
6. 再次用 API 查对照账号的 totalItems

## 期望结果

- 测试账号 totalItems 不超过 loginHistoryMaximumEntries
- 保留的记录是时间最新的若干条，最旧的已被删除
- 测试账号 status.lastLoginTime 等于或晚于本次登录时间
- 对照账号 totalItems 与开始时一致

## 失败排查

- 记录数仍超上限：裁剪未在写入路径执行，或上限配置未下发
- 对照账号也变少：裁剪误扫了全量用户，应只按 UserReferenceLabel 过滤当前用户
- lastLoginTime 未变：更新走的是 Update 而非 UpdateStatus，或跳过条件写反
- 登录返回 500：清理失败被当成了登录失败，应只记日志

## 产品改版后如何更新自动化

- 后端断言在 kube-server/pkg/models/auth/login_recoder_test.go，UI 无需新选择器
