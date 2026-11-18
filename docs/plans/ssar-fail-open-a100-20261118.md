# A100 上 SSAR 对非管理员也返回 allowed（2026-11-18 实测）

## 现象

用一个**非管理员**账号（`tests/ui/.env` 里的 `KA_LOGIN_USERNAME`）实测：

```
GET  /apis/rbac.authorization.k8s.io/v1/clusterrolebindings   -> 403   ← 证明它确实不是管理员
POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews
  list   configmaps    ns=default   -> 201 allowed=True
  delete nodes                      -> 201 allowed=True   ← 它删不了节点
  create clusterroles               -> 201 allowed=True   ← 它建不了集群角色
```

**同一个账号读不了 clusterrolebindings，却被告知可以删除节点、创建集群角色。**

## 这正是已登记的那个后端问题

[权限检查后端记录](permission-review-backend-20261117.md) 写过：`/apis` 的 SSAR **以 ks 的 service account 求值**，
于是所有检查都返回 allowed。ks-apiserver 后来加了 IAM 的 `selfsubjectaccessreviews`（`d472dec55` / `f0643379e`），
但那两个提交**只部署到了 B200**（`node-join-20261118c`），A100 还是旧后端。

## 对迁移的影响

控制台的创建/删除门控读的就是 SSAR 的 `allowed`（`useCreatePermission` 等）。在没修的后端上：

- 每个用户都**看得见**所有创建/删除控件；
- 点下去才会在真正写入时被 403 拒绝；
- 所以「按钮可见性」在这类部署上**不能作为权限验收的证据**。

## 怎么判断某个环境能不能验权限

```bash
# 用非管理员账号，看它是否被误判为可以删节点
POST /apis/authorization.k8s.io/v1/selfsubjectaccessreviews  {verb: delete, resource: nodes}
# allowed=true 且该账号读不了 clusterrolebindings -> 该环境的后端没修，权限验收不成立
```

## 边界

本轮只在 **A100**（旧后端）验到；B200 部署了修复但当前只有旧产物 + 隧道不稳，未复验；
mlu370 的后端较新（登录路由返回 400 而非 403），但缺凭据未验。**不要把这个结论推广到所有环境。**
