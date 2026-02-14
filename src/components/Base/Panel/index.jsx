/*
 * This file is part of KubeSphere Console.
 * Copyright (C) 2019 The KubeSphere Console Authors.
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
import classNames from 'classnames'

import { Loading } from '@kube-design/components'

import * as styles from './index.scss'

export default class Panel extends React.Component {
  render() {
    const { className, title, loading = false, children, extras } = this.props
    const titleStr = typeof title === 'string' ? title : ''
    const empty = (
      <div className={styles.empty}>
        {t('NO_AVAILABLE_RESOURCE_VALUE', { resource: titleStr || 'resource' })}
      </div>
    )

    return (
      <div
        className={styles.wrapper}
        data-test={`panel-${
          titleStr
            ? titleStr
                .toLowerCase()
                .split(' ')
                .join('-')
            : 'default'
        }`}
      >
        {title && <div className={styles.title}>{title}</div>}
        <div className={classNames(styles.panel, className)}>
          {loading ? <Loading className={styles.loading} /> : children || empty}
        </div>
        {extras}
      </div>
    )
  }
}
