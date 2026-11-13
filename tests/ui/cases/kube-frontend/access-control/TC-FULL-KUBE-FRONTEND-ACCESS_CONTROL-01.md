# TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01 访问控制 · 三页签切换且无项目工作区栏

- **用例 ID**: `TC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01`
- **级别**: L2  **套件**: `full`
- **模块**: `kube-frontend` / `access-control` `page`
- **入口**: `{BASE_URL}/kube-frontend/access/users`
- **需求**: `prd/kube-frontend/access-control/_index.md`

## 产品功能

['平', '台', '级', '三', '张', '表', '在', '客', '户', '端', '切', '换', '，', '且', '不', '出', '现', '项', '目', '工', '作', '区', '栏', '。']

### 关联需求

- `prd/kube-frontend/access-control/_index.md`

### 覆盖的验收场景

文案来自需求 [`prd/kube-frontend/access-control/_index.md`](../../../../prd/kube-frontend/access-control/_index.md)，与用例的 `covers` 对应；改需求即改这里。

- **AC-FULL-KUBE-FRONTEND-ACCESS_CONTROL-01** — 已知已登录且有平台权限，当在三个页签之间切换，则每次都显示对应列表（或空态），页签高亮跟随，切换不产生文档请求，且页面不出现项目工作区栏。

### 关联设计

- 技术方案 [`design/kube-frontend/access-control/_index.md`](../../../../design/kube-frontend/access-control/_index.md)

## 覆盖的用户故事

文案来自需求 [`prd/kube-frontend/access-control/_index.md`](../../../../prd/kube-frontend/access-control/_index.md)，与用例的 `story` 对应；改需求即改这里。

### US1 - 在平台视角下切换三张表 (Priority: P1)

作为 **平台管理员**，我希望 **在三个页签之间切换**，以便 **不必反复从顶部切换模块**。

**Independent Test**：从用户切到企业空间再切回，核对页签高亮变化且无整页刷新。

### US2 - 明确知道这些页面与项目无关 (Priority: P2)

作为 **平台管理员**，我希望 **页面不出现项目切换器**，以便 **不会误以为筛选会生效**。

**Independent Test**：打开任一平台页，核对没有项目工作区栏。

## 前置与配置

- 已登录，且有平台权限

## 测试步骤

1. 打开用户页
2. 确认没有项目工作区栏
3. 依次切到平台角色、企业空间、用户
4. 统计切换期间的文档请求

## 期望结果

- 每页显示对应列表或空态
- 页面不出现 workspace-bar
- 切换后页签高亮跟随
- 切换期间文档请求为 0

## 失败排查

- 出现工作区栏说明平台页复用了项目布局
- 出现文档请求说明页签退化成整页跳转

## 产品改版后如何更新自动化

- 布局变化时改 routes/kube-frontend.access/route.tsx
