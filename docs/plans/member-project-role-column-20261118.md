# 成员详情补「项目角色」列（2026-11-18）

## 缺口

能力矩阵「租户(企业空间)成员 列表+详情」的「项目」页签只列**命名空间名 + 创建时间**，
读者看不出这个成员在每个项目里是什么角色。

## 数据来源（实测确认）

KubeSphere 把项目角色绑成**普通命名空间 RoleBinding**，subjects 里带用户名：

```
GET /kapis/resources.kubesphere.io/v1alpha3/namespaces/default/rolebindings
  -> 5 条，sample: roleRef=viewer, subjects=[tc-e2e-954357-sa]
```

没有「某人在本企业空间下所有项目的角色」这种聚合路由，所以按项目逐个查（上限 60 个，避免把详情页变成风暴）。

## 实现

| 层 | 改动 |
| --- | --- |
| api-client | `rolesForUser(bindings, username)` 纯函数 + `members.memberProjectRoles(...)`（每项目一次请求，读不到就当没有角色） |
| 页面 | 「项目」页签新增 **项目角色** 列；无绑定显示 `-`（不是空白、不是 0） |
| 文案 | `workspace.field.projectRole`：项目角色 / Project role |

## 验证

| 检查 | 结果 |
| --- | --- |
| 浏览器 | 表头 `['名称', '项目角色', '创建时间']`，行如 `weave | - | 2026-11-15 21:49:25` |
| 单元测试 | `rolesForUser` 两条：只算命名该用户的绑定、同一项目多个角色都返回；api-client 50 文件 / **471 passed** |
| `tsc` / `vite build` | 0 / ✓ |

## 正例（已补验）

本部署原本没有任何项目级绑定，列上全是 `-`。为验证正例，临时建了一条唯一命名的绑定：

```
POST /apis/rbac.authorization.k8s.io/v1/namespaces/default/rolebindings
  name=tc-rolecheck-fbc37921  roleRef=viewer  subjects=[User:test]   -> 201
```

成员详情里 `default` 行立刻显示：

```
default    viewer    2026-03-31 10:58:07
```

随后删除并复核：`DELETE -> 200`、`GET -> 404`（**已清理，无残留**）。

**顺带发现**：聚合网关 `/kapis/resources.kubesphere.io/v1alpha3/...` 对 RoleBinding 是**只读**的
（POST 返回 405），写要走原生 `/apis/rbac.authorization.k8s.io/v1/...`。

## 未覆盖

多角色并存（同一项目两个 RoleBinding）未在真实环境验证；单元测试覆盖了合并逻辑。
