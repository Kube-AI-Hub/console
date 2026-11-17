# 静态站被接到另一个 BFF 上（2026-11-18）

## 现象

B200 的巡检一直 `state=signed-out`，每页 34.6 秒，整段却报「0 error」。

## 根因

`5178` 这个静态站实际代理到了 **8093（A100 的 BFF）**，而巡检用 8092 签发的 token：

```
GET http://127.0.0.1:8092/api/session/me                       with 8092 token -> 200
GET http://127.0.0.1:5178/kube-frontend/api/session/me         with 8092 token -> 401
GET http://127.0.0.1:5178/kube-frontend/api/session/me         with 8093 token -> 200   ← 证据
```

于是应用每次都把读者送回登录页，而巡检把这当成「页面渲染了、只是没有数据」。

## 处置：preflight 校验「应用与 BFF 是配对的」

登录成功后，用**同一个 token 经应用**请求 `/api/session/me`；不是 200 就直接拒绝开跑：

```
preflight: the app at http://localhost:5178 does not accept the token from http://127.0.0.1:8092 (status 401)
preflight: the static site is wired to a different BFF; fix that before sweeping
NOT RUN: the environment is not usable
```

## 为什么这条值得单独加

一个静态站可以指向任意 BFF，两者**没有任何交叉校验**。配错之后：

| 表面现象 | 真实情况 |
| --- | --- |
| 页面 0 error | 页面是登录页 |
| 每页 30 秒以上 | 在等一个永远不会出现的 shell |
| 结论「成员集群没问题」 | 其实一个页面都没看到 |

这是整轮里最隐蔽的一类假绿：**环境接错线，工具却报成功**。
