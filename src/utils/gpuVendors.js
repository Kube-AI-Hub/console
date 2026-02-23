/*
 * Copyright (C) 2026 Kube AI Hub.
 *
 * KubeSphere Console is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * KubeSphere Console is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with KubeSphere Console.  If not, see <https://www.gnu.org/licenses/>.
 */

import React from 'react'
import { ReactComponent as AlibabaVendorIcon } from 'assets/gpu-vendors/alibaba.svg'
import { ReactComponent as AscendVendorIcon } from 'assets/gpu-vendors/ascend.svg'
import { ReactComponent as CambriconVendorIcon } from 'assets/gpu-vendors/cambricon.svg'
import { ReactComponent as DefaultVendorIcon } from 'assets/gpu-vendors/default.svg'
import { ReactComponent as EnflameVendorIcon } from 'assets/gpu-vendors/enflame.svg'
import { ReactComponent as HygonVendorIcon } from 'assets/gpu-vendors/hygon.svg'
import { ReactComponent as IluvatarVendorIcon } from 'assets/gpu-vendors/iluvatar.svg'
import { ReactComponent as KunlunxinVendorIcon } from 'assets/gpu-vendors/kunlunxin.svg'
import { ReactComponent as MetaxVendorIcon } from 'assets/gpu-vendors/metax.svg'
import { ReactComponent as MthreadsVendorIcon } from 'assets/gpu-vendors/mthreads.svg'
import { ReactComponent as NvidiaVendorIcon } from 'assets/gpu-vendors/nvidia.svg'

export const GPU_VENDOR_FILTERS = [
  { text: t('XPU_VENDOR_NVIDIA'), value: 'nvidia' },
  { text: t('XPU_VENDOR_CAMBRICON'), value: 'cambricon' },
  { text: t('XPU_VENDOR_ASCEND'), value: 'ascend' },
  { text: t('XPU_VENDOR_HYGON'), value: 'hygon' },
  { text: t('XPU_VENDOR_METAX'), value: 'metax' },
  { text: t('XPU_VENDOR_ENFLAME'), value: 'enflame' },
  { text: t('XPU_VENDOR_KUNLUNXIN'), value: 'kunlunxin' },
  { text: t('XPU_VENDOR_ILUVATAR'), value: 'iluvatar' },
  { text: t('XPU_VENDOR_ALIBABA'), value: 'alibaba' },
  { text: t('XPU_VENDOR_MTHREADS'), value: 'mthreads' },
]

const GPU_VENDOR_ICONS = {
  nvidia: NvidiaVendorIcon,
  cambricon: CambriconVendorIcon,
  ascend: AscendVendorIcon,
  hygon: HygonVendorIcon,
  metax: MetaxVendorIcon,
  enflame: EnflameVendorIcon,
  kunlunxin: KunlunxinVendorIcon,
  iluvatar: IluvatarVendorIcon,
  alibaba: AlibabaVendorIcon,
  mthreads: MthreadsVendorIcon,
}

const normalizeVendor = vendor => String(vendor || '').toLowerCase()

export const getGpuVendorIcon = vendor =>
  GPU_VENDOR_ICONS[normalizeVendor(vendor)] || DefaultVendorIcon

export const renderGpuVendorIcon = (vendor, size = 40) => {
  const VendorIcon = getGpuVendorIcon(vendor)
  return (
    <VendorIcon
      width={size}
      height={size}
      style={{ color: 'currentColor', flexShrink: 0, marginRight: '12px' }}
      aria-hidden
    />
  )
}

export const renderGpuVendorWithIcon = (vendor, label) => {
  if (!label) return '-'
  const VendorIcon = getGpuVendorIcon(vendor)
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
      <VendorIcon
        width={16}
        height={16}
        style={{ color: 'currentColor', flexShrink: 0 }}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  )
}
