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

const { resolve } = require('path')
const webpack = require('webpack')
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin')
const baseConfig = require('./webpack.base')
const localeConfig = require('./webpack.locale')

const root = path => resolve(__dirname, `../${path}`)

const config = {
  mode: 'development',
  entry: baseConfig.entry,
  output: {
    filename: '[name].js',
    path: root('dist/'),
    publicPath: '/dist/',
  },
  devtool: 'eval-cheap-module-source-map',
  module: {
    rules: [
      ...baseConfig.moduleRules,
      {
        test: /\.(ttf|otf|eot|woff2?)(\?.+)?$/,
        include: root('src/assets'),
        type: 'asset/resource',
        generator: {
          filename: 'assets/[name].[ext]',
        },
      },
    ],
  },
  optimization: {
    usedExports: true,
    splitChunks: {
      chunks: 'async',
      minChunks: 1,
      cacheGroups: {
        vendors: {
          test: /[\\/]node_modules[\\/](?!(ace-builds|react-ace|@xterm)).*.jsx?$/,
          name: 'vendor',
          priority: 10,
        },
        common: {
          name: 'common',
          minChunks: 2,
          minSize: 30000,
        },
      },
    },
  },
  resolve: baseConfig.resolve,
  cache: {
    type: 'filesystem',
    buildDependencies: {
      config: [__filename],
    },
  },
  plugins: [
    ...baseConfig.plugins,
    new ReactRefreshWebpackPlugin({ overlay: false }),
    new webpack.WatchIgnorePlugin({
      paths: [
        root('node_modules'),
        root('server'),
        root('build'),
        root('dist'),
      ],
    }),
    new webpack.DefinePlugin({
      'process.env.BROWSER': true,
      'process.env.NODE_ENV': JSON.stringify('development'),
    }),
  ],
  devServer: {
    static: {
      directory: root('dist/'),
      publicPath: '/dist',
    },
    client: {
      logging: 'info',
      overlay: {
        errors: true,
        warnings: false,
      },
    },
    allowedHosts: 'all',
    host: '0.0.0.0',
    port: 8001,
    hot: true,
    compress: true,
    headers: (req, res) => {
      const origin = req.headers.origin
      res.setHeader('Access-Control-Allow-Origin', origin || '*')

      res.setHeader('Access-Control-Allow-Credentials', 'true')

      res.setHeader(
        'Access-Control-Allow-Methods',
        'GET, POST, PUT, DELETE, OPTIONS'
      )

      res.setHeader(
        'Access-Control-Allow-Headers',
        'Access-Control-Allow-Headers,Origin,Accept,X-Requested-With,Content-Type,Access-Control-Request-Method,Access-Control-Request-Headers,DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Range,Authorization'
      )

      res.setHeader('Access-Control-Max-Age', '86400')

      if (req.method === 'OPTIONS') {
        res.status = 204
      }
    },
  },
}

module.exports = [config, localeConfig]
