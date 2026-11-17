# 登录页把 k8s 的 403 原文抛给了用户（2026-11-18）

## 现象

后端没有 `login.oauth.kubesphere.io` 路由时，登录页整句显示：

```
login.oauth.kubesphere.io is forbidden: User "system:anonymous" cannot create resource
"login" in API group "oauth.kubesphere.io" at the cluster scope
```

读者看到的是 k8s 的 Status 文本，不是能行动的信息。

## 原因

`phraseLoginError` 只翻译 `LOGIN_ERROR_CODES` 里的四种，其余一律 `return cause.message`。
这类失败在 k8s Status 里带的是数字 `code: 403`，不匹配任何登录错误码，于是走了兜底。

## 修法

登录路由上的 **403 / 404 / 405** 不是「密码错」，而是**后端没有这种登录方式**，单独成句：

```ts
if (cause.status === 403 || cause.status === 404 || cause.status === 405) {
  return t('login.backendUnsupported');
}
```

文案：中文「当前后端不支持这种登录方式（需要更新的 ks-apiserver）」/ 英文对应句。

## 验证

| 检查 | 结果 |
| --- | --- |
| `tsc` | 0 |
| 契约套件 | 18 文件 / 1569 passed |

## 未覆盖

**没有在浏览器里复现新文案**——当前部署仍返回 403，但按用户指示暂停界面验收；等重构部署后一并复验。
