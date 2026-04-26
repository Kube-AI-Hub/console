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

import { get } from 'lodash'
import React from 'react'
import PropTypes from 'prop-types'
import { Button, Dropdown, Menu } from '@kube-design/components'
import { Avatar } from 'components/Base'
import * as styles from './index.scss'

export default class UserItem extends React.Component {
  static propTypes = {
    user: PropTypes.object,
    roles: PropTypes.array,
    selected: PropTypes.bool,
    onSelect: PropTypes.func,
  }

  getDesc(role) {
    const _desc = get(role, 'description')
    return t(_desc)
  }

  handleMoreMenuClick = (e, key) => {
    const { onSelect, user } = this.props
    onSelect(user.username, key)
  }

  renderMoreMenu() {
    const { roles = [] } = this.props

    return (
      <div className={styles.menu}>
        <p>{t('ASSIGN_ROLE')}</p>
        <Menu onClick={this.handleMoreMenuClick}>
          {roles.length > 0 ? (
            roles.map(role => (
              <Menu.MenuItem key={role.name}>
                <Avatar
                  className={styles.avatar}
                  icon="role"
                  iconSize={40}
                  title={role.name}
                  desc={this.getDesc(role)}
                  noLink
                />
              </Menu.MenuItem>
            ))
          ) : (
            <Menu.MenuItem disabled>
              <div style={{ padding: '8px' }}>{t('NO_AVAILABLE_ROLE')}</div>
            </Menu.MenuItem>
          )}
        </Menu>
      </div>
    )
  }

  render() {
    const { user, onSelect, selected } = this.props

    return (
      <div className={styles.item} data-user={user.username}>
        <div className={styles.itemMain}>
          <p>
            <strong>{user.username}</strong>
          </p>
          <p>{user.email}</p>
        </div>
        <div className={styles.itemActions}>
          {!selected && (
            <Dropdown
              content={this.renderMoreMenu()}
              trigger="click"
              placement="bottomRight"
              style={{ zIndex: 2100 }}
            >
              <Button
                type="control"
                icon="add"
                iconType="light"
              />
            </Dropdown>
          )}
          {selected && <Button type="flat" icon="check" disabled />}
        </div>
      </div>
    )
  }
}
