/*
 * Copyright 2026 Kube AI Hub.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/**
 * Per-vendor GPU shared/virtualization mode options. Params are per-mode.
 * modeOptions: [{ labelKey, value, params?: [{ key, labelKey, descKey?, type, default }] }].
 */
export const GPU_VENDOR_MODE_CONFIG = {
  cambricon: {
    modeOptions: [
      {
        labelKey: 'GPU_MODE_DEFAULT',
        value: 'default',
        descKey: 'GPU_MODE_DEFAULT_DESC',
        params: [],
      },
      {
        labelKey: 'GPU_MODE_DYNAMIC_SMLU',
        value: 'dynamic-smlu',
        descKey: 'GPU_MODE_DYNAMIC_SMLU_DESC',
        params: [
          {
            key: 'min-dsmlu-unit',
            labelKey: 'GPU_PARAM_MIN_DSMLU_UNIT',
            descKey: 'GPU_PARAM_MIN_DSMLU_UNIT_DESC',
            type: 'number',
            default: 256,
          },
        ],
      },
      {
        labelKey: 'GPU_MODE_ENV_SHARE',
        value: 'env-share',
        descKey: 'GPU_MODE_ENV_SHARE_DESC',
        params: [
          {
            key: 'virtualization-num',
            labelKey: 'GPU_PARAM_VIRTUALIZATION_NUM',
            descKey: 'GPU_PARAM_VIRTUALIZATION_NUM_DESC',
            type: 'number',
            default: 5,
          },
        ],
      },
    ],
  },
  nvidia: {
    modeOptions: [
      {
        labelKey: 'GPU_MODE_DEFAULT',
        value: 'default',
        descKey: 'GPU_MODE_DEFAULT_DESC',
        params: [],
      },
      {
        labelKey: 'GPU_MODE_MIG',
        value: 'mig',
        descKey: 'GPU_MODE_MIG_DESC',
        params: [],
      },
      {
        labelKey: 'GPU_MODE_HAMI_VGPU',
        value: 'hami-vgpu',
        descKey: 'GPU_MODE_HAMI_VGPU_DESC',
        params: [],
      },
    ],
  },
}

export function getVendorModeConfig(gpuVendor) {
  if (!gpuVendor || typeof gpuVendor !== 'string') return null
  return GPU_VENDOR_MODE_CONFIG[gpuVendor.toLowerCase()] || null
}

export function getParamsForMode(vendorConfig, mode) {
  if (!vendorConfig || !vendorConfig.modeOptions) return []
  const opt = vendorConfig.modeOptions.find(o => o.value === mode)
  return opt && opt.params ? opt.params : []
}

export function getModeOption(vendorConfig, mode) {
  if (!vendorConfig || !vendorConfig.modeOptions) return null
  return vendorConfig.modeOptions.find(o => o.value === mode) || null
}
