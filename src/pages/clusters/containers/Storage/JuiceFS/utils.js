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

// Binary units, because every number on this page comes from Kubernetes
// quantities and statfs, both of which are base-2.
export const formatBytes = (bytes = 0, precision = 1) => {
  const value = Number(bytes) || 0
  if (value <= 0) return '0'

  const units = ['B', 'KiB', 'MiB', 'GiB', 'TiB', 'PiB']
  let index = 0
  let scaled = value
  while (scaled >= 1024 && index < units.length - 1) {
    scaled /= 1024
    index += 1
  }
  const digits = index >= 3 ? precision : 0
  return `${scaled.toFixed(digits)} ${units[index]}`
}

export const usagePercent = (used = 0, capacity = 0) => {
  if (!capacity || capacity <= 0) return 0
  return Math.min(100, (Number(used) / Number(capacity)) * 100)
}

// The colour bands the page uses for a usage bar. Kept in one place so the
// overview and the volume table cannot disagree about what "nearly full" means.
export const usageLevel = percent => {
  if (percent >= 90) return 'error'
  if (percent >= 80) return 'warning'
  return 'safe'
}

/**
 * The quota the operator asked for (PV capacity) and what the client currently
 * reports (statfs) can disagree for a while after a change: JuiceFS caches
 * directory stats per client. Surfacing that beats showing a number that looks
 * wrong.
 */
export const isQuotaDrift = (reportedCapacity, capacityBytes) => {
  if (!reportedCapacity || !capacityBytes) return false
  return Math.abs(reportedCapacity - capacityBytes) / capacityBytes > 0.01
}
