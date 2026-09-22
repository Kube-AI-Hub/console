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
import PropTypes from 'prop-types'
import classnames from 'classnames'
import { Link } from 'react-router-dom'
import { Button, Icon, Menu, Dropdown } from '@kube-design/components'
import { isAppsPage, getWebsiteUrl } from 'utils'
import { visibleProductEntries } from 'utils/returnPath'

import LoginInfo from '../LoginInfo'

import * as styles from './index.scss'

class Header extends React.Component {
  static propTypes = {
    className: PropTypes.string,
    innerRef: PropTypes.object,
    jumpTo: PropTypes.func,
  }

  get isLoggedIn() {
    return Boolean(globals.user)
  }

  handleLinkClick = link => () => {
    this.props.jumpTo(link)
  }

  handleDocumentLinkClick = (e, key) => {
    window.open(key)
  }

  handlePlatformNavClick = (e, key) => {
    this.props.jumpTo(key)
  }

  handleExternalLinkClick = url => () => {
    window.open(url, '_blank')
  }

  handleDocumentNav = url => () => {
    window.location.assign(url)
  }

  renderProductEntry = entry => {
    const { location } = this.props
    const entries = {
      workbench: {
        title: 'WORKBENCH',
        icon: 'dashboard',
        onClick: this.handleLinkClick('/'),
        active: location.pathname === '/',
      },
      studio: {
        title: 'AGENT_WORKSHOP',
        icon: 'strategy-group',
        onClick: this.handleDocumentNav('/studio/'),
        active: location.pathname.startsWith('/studio'),
      },
      models: {
        title: 'LARGE_MODEL',
        icon: 'ai',
        onClick: this.handleExternalLinkClick('/platform-model/'),
      },
      plaza: {
        title: 'DONGBA',
        icon: 'application',
        onClick: this.handleExternalLinkClick('/dongba/'),
      },
      operations: {
        title: 'GOVERNANCE',
        icon: 'monitor',
        onClick: this.handleDocumentNav('/operations/'),
        active: location.pathname.startsWith('/operations'),
      },
    }
    const item = entries[entry]
    return (
      <Button
        key={entry}
        type="flat"
        icon={item.icon}
        onClick={item.onClick}
        className={classnames({
          [styles.active]: item.active,
        })}
      >
        {t(item.title)}
      </Button>
    )
  }

  renderDocumentList() {
    const { url, api } = getWebsiteUrl()
    return (
      <Menu onClick={this.handleDocumentLinkClick} data-test="header-docs">
        <Menu.MenuItem key={url}>
          <Icon name="hammer" /> {t('USER_GUIDE')}
        </Menu.MenuItem>
        <Menu.MenuItem key={api}>
          <Icon name="api" /> {t('API_DOCUMENT')}
        </Menu.MenuItem>
      </Menu>
    )
  }

  renderPlatformNav() {
    const navs = globals.app.getGlobalNavs()
    return (
      <Menu onClick={this.handlePlatformNavClick} data-test="header-platform">
        {navs.map(nav => (
          <Menu.MenuItem key={`/${nav.name}`}>
            <Icon name={nav.icon} /> {t(nav.title)}
          </Menu.MenuItem>
        ))}
      </Menu>
    )
  }

  render() {
    const { className, innerRef } = this.props
    const logo = globals.config.logo || '/assets/logo.svg'

    return (
      <div
        ref={innerRef}
        className={classnames(
          styles.header,
          {
            [styles.inAppsPage]: isAppsPage(),
          },
          className
        )}
      >
        <Link to={isAppsPage() && !globals.user ? '/apps' : '/'}>
          <svg
            className={styles.logo}
            viewBox="0 0 20 20"
            preserveAspectRatio="xMidYMid meet"
          >
            <use href={isAppsPage() ? `/assets/login-logo.svg` : logo} />
          </svg>
        </Link>
        <div className="header-bottom" />
        {this.isLoggedIn && (
          <div className={styles.navs}>
            {globals.app.enableGlobalNav && (
              <Dropdown content={this.renderPlatformNav()}>
                <Button
                  type="flat"
                  icon="cogwheel"
                >
                  {t('PLATFORM')}
                </Button>
              </Dropdown>
            )}
            {globals.app.enableAppStore && (
              <Button
                type="flat"
                icon="appcenter"
                onClick={this.handleLinkClick('/apps')}
                className={classnames({
                  [styles.active]: location.pathname === '/apps',
                })}
              >
                {t('APP_STORE')}
              </Button>
            )}
            {visibleProductEntries(
              (globals.config && globals.config.portal) || {}
            ).map(entry => this.renderProductEntry(entry))}
          </div>
        )}
        <div className={styles.right}>
          {this.isLoggedIn && (
            <Dropdown content={this.renderDocumentList()}>
              <Button type="flat" icon="documentation" />
            </Dropdown>
          )}
          <LoginInfo className={styles.loginInfo} isAppsPage={isAppsPage()} />
        </div>
      </div>
    )
  }
}

export default Header
