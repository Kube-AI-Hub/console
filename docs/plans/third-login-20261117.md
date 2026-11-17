# 第三方登录状态页（2026-11-17）

> 本批交付证据。范围：N-02 —— 平台设置 › 第三方登录状态页（只读）。
> **范围修正**：老页面的 Configure 弹窗 onOk 只关闭、不发请求（源码核对），因此没有可迁移的写能力；本批交付状态视图与「接口不存在」的如实说明。

## 1. 范围与基线

| 项 | 本页记录 |
| --- | --- |
| 用户任务、作用域 | 平台管理员确认当前身份源/为什么没有第三方登录 |
| 旧入口、部署 URL | 老 console settings/containers/ThirdPartyLogin（两张固定「未配置」卡片 + Configure 假表单） |
| 新入口 | /kube-frontend/settings/third-login；平台设置区域页签 |
| 环境、集群、角色 | B200 本地全栈（静态站 5176 → BFF 8092）；admin；identityproviders 两种拼写均 404 |
| 视口、主题 | 1600×1000 浅色；其余待补 |
| 子页面与状态范围 | 加载/可用（卡片/空态）/不可用（404、5xx）/错误（403、网络） |
| 明确排除及批准 | 凭据编辑（老实现无写请求）；登录页第三方按钮；LDAP 连接测试 |
| 并行/安全边界 | 只新增页面/API/文档；E2E 只读 |

## 2. 旧能力全集与归宿

| 旧能力 ID | 源码/部署证据 | 显示条件/角色 | 字段/动作 | 归宿 | 新 AC/用例/断言 | 状态 |
| --- | --- | --- | --- | --- | --- | --- |
| LEG-THIRD-01 | ThirdPartyLogin 页面两张卡片 | 平台管理员 | Github OAuth / OAuth 固定显示「未配置」 | 状态页卡片（接口可用时按真实身份源） | AC-THIRD-01；TC | 通过（B200 不可用分支） |
| LEG-THIRD-02 | OAuth/GithubOAuth 弹窗 | — | 名称/clientID/server/secret；**onOk 仅关闭** | 不迁移；页面说明无写能力 | AC-THIRD-01；文档 | 明确不做（旧实现无请求） |
| LEG-THIRD-03 | 登录页 oauthServers | 登录用户 | 登录页第三方按钮 | 既有登录页；不在本页 | 边界说明 | 既有 |

**计数**：1 项状态能力交付；1 项明确不迁移（假表单）；登录页既有。

## 3. 数据契约与全链路

| 能力 | 请求 | 字段 | 规则 | 映射 | 异常 | 断言 |
| --- | --- | --- | --- | --- | --- | --- |
| 身份源列表 | GET /kapis/iam…/v1alpha2/identityproviders?limit=-1；回退 /apis/… | items[].metadata.name、spec.type、spec.displayName | 首个非 404 生效 | identityProvidersApi.list | 两接口均 404/5xx → available:false；403 → throw | 单测映射/回退/403；E2E 按探测分支 |
| 页面状态 | — | — | available+0 → empty；available+N → cards；false → unavailable；error → error面板 | ThirdLoginPage | — | E2E unavailable（B200） |

## 4. 交互与复用基线

- 卡片：显示名、对象名、类型、已配置徽标；底部说明只读与旧表单事实。
- 不可用：标题/描述/原因/重试；空态：区别文案。
- 复用 AiSurface/Button/Badge/Skeleton/ResourceErrorPanel；无写控件。

## 5. 编码与回归

- [x] US1/AC-THIRD-01 覆盖可用 N>0/N=0、不可用、403 四态。
- [x] API 单测 3 条；E2E TC-THIRD-01（B200）。
- [x] tsc/build 通过；契约与既有测试通过。
- [x] 未提交/未推送；并行文件未回退。

## 6. 完成判定与证据

| 维度 | 状态 | 证据 | 未验收项 |
| --- | --- | --- | --- |
| 旧能力覆盖 | 通过 | 状态视图 + 明确不迁移假表单 | — |
| 数据语义 | 通过（单测+B200） | 两种拼写回退、404→不可用、403→错误 | 接口可用的真实部署（mlu370 未知） |
| 交互与权限 | 通过（admin） | 页面入口与不可用态 | 非 admin |
| 视觉 | 通过（B200 1600/1280/1024 深浅） | 不可用态截图 + 三档深浅 | 旧站对照未生成 |
| 静态/类型/构建/测试 | 通过 | tsc 0；contracts 18/1544；api-client 44/441（新增 identity 3）；build ✓ | — |
| 部署/全站 | 未执行 | — | 镜像部署与全站串行 E2E |

## 7. 测试命令与结果

    cd console/kube-frontend
    npx tsc --noEmit -p apps/console-next/tsconfig.json → 0 error
    pnpm --filter @kube-ai-hub/console-next build → 通过
    npx vitest run packages/api-client/test/identity-providers.test.ts → 3 passed

    # E2E（B200）
    KA_APP_URL=http://localhost:5176 KA_CLUSTER=host KA_USERNAME=admin KA_PASSWORD=*** \
      pytest tests/.../test_TC_L3_..._THIRD_LOGIN_01.py -n 0 → 1 passed (3.26s)

## 8. 截图与记录

assets/third-login-20261117/new：third-login.png（B200 1600 浅色，不可用说明）。

## 9. 剩余项与复查条件

| 项 | 状态 | 复查条件 |
| --- | --- | --- |
| 接口可用分支的真实证据 | 未观察到（B200 404） | 在提供 identityproviders 的部署复跑，E2E 会自动切卡片断言 |
| 凭据写能力 | 明确不做 | 平台提供受支持写接口与凭据规范后另立 |
| 旧站对照 | 未生成 | 设计走查补 |
| 非 admin/部署/全站 | 未验收 | 普通管理员、镜像与全站串行 E2E |

## 10. 流程反思

| 本批踩到的事 | 已写入 |
| --- | --- |
| 老页面有「配置」按钮但弹窗 onOk 不提交，差点按 UI 表象设计写接口 | 指南 §8 #36：迁移前查 action 链/请求，按钮不等于能力 |
| identityproviders 在部分部署不存在，空列表会给出错误结论 | 设计 DEC-01：独立不可用状态；403 不伪装 |

## 11. 关联文档

- PRD：prd/kube-frontend/platform-settings/third-login.md
- design：design/kube-frontend/platform-settings/third-login.md
- 用例：TC-L3-KUBE-FRONTEND-PLATFORM_SETTINGS-THIRD_LOGIN-01
- 老页面：settings/containers/ThirdPartyLogin + Modals/{OAuth,GithubOAuth}
