---
title: "Model Inference FAQ"
keywords: "Industry AI Model Platform, model inference, FAQ"
description: "Frequently asked questions about dedicated model inference instances."
linkTitle: "Model Inference FAQ"
weight: 6220
---

## FAQ

### The deploy button is grayed out with message "Inference framework does not support this model"

**Cause**: The current inference framework does not yet support this model architecture.

**Solution**: Contact the platform administrator with the model name and relevant details. The administrator will evaluate and add support as soon as possible.

---

### The deploy button is grayed out with message "Model metadata not recognized"

**Cause**: The model files are incomplete, or the model's configuration information (architecture info in `config.json`) cannot be automatically recognized.

**Solution**:
1. Confirm the model repository contains a complete `config.json` file.
2. Contact the platform administrator to manually trigger a model metadata scan.

---

### Instance is stuck in "Starting" state for a long time

**Cause**: Compute resources may be tight, or the model image pull is taking a long time.

**Solution**:
1. Wait a while (large model image pulls may take several minutes).
2. If the instance has not started after 15 minutes, contact the platform administrator.

---

### API call returns 401 Unauthorized

**Cause**: The instance security level is **Private** and the request does not include a valid access token.

**Solution**: Add an access token to the request header:

```bash
-H "Authorization: Bearer <access-token>"
```

Access tokens can be generated in **User Settings → Access Tokens**.
