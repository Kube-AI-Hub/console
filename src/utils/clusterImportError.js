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
 * See the License for the applicable language governing permissions and
 * limitations under the License.
 */

/**
 * Turn a cluster validation / create failure into a sentence the wizard can show.
 *
 * ks-apiserver answers `/clusters/validation` with a JSON `Status`
 * (`message` plus `reason`). The request helper
 * also calls the reject callback with opposite argument order for those two
 * paths, so callers pass every candidate and this picks the first usable text.
 */

function textOf(value) {
  if (!value) {
    return ''
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  if (typeof value.message === 'string' && value.message.trim()) {
    return value.message.trim()
  }
  if (typeof value.reason === 'string' && value.reason.trim()) {
    return value.reason.trim()
  }
  return ''
}

export function messageFromUnknown(...candidates) {
  for (const value of candidates) {
    const text = textOf(value)
    if (text && text !== 'Bad Request' && text !== 'Internal Server Error') {
      return text
    }
  }
  for (const value of candidates) {
    const text = textOf(value)
    if (text) {
      return text
    }
  }
  return ''
}

export function clusterImportErrorText(...candidates) {
  const raw = messageFromUnknown(...candidates)
  if (/jwt is not equal/i.test(raw)) {
    return t('CLUSTER_IMPORT_JWT_MISMATCH')
  }
  if (/clusterRole of the member cluster must be/i.test(raw)) {
    return t('CLUSTER_IMPORT_CLUSTER_ROLE')
  }
  if (/unable validate kubesphere endpoint/i.test(raw)) {
    return t('CLUSTER_IMPORT_MEMBER_APISERVER')
  }
  if (/MUST not import the same cluster twice/i.test(raw)) {
    return t('CLUSTER_IMPORT_ALREADY_EXISTS')
  }
  if (
    /timeout|i\/o timeout|connection refused|no route to host|network is unreachable|dial tcp/i.test(
      raw
    )
  ) {
    return t('CLUSTER_IMPORT_UNREACHABLE')
  }
  if (/already exists/i.test(raw)) {
    return t('CLUSTER_IMPORT_CONFLICT')
  }
  if (!raw || /internal server error/i.test(raw)) {
    return t('CLUSTER_IMPORT_INTERNAL')
  }
  return raw
}
