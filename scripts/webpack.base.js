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
const WebpackBar = require('webpackbar')
const WebpackAssetsManifest = require('webpack-assets-manifest')
const MiniCssExtractPlugin = require('mini-css-extract-plugin')
const createStyledComponentsTransformer = require('typescript-plugin-styled-components').default

// Create the transformer instance outside the getCustomTransformers function
const styledComponentsTransformer = createStyledComponentsTransformer()

const root = path => resolve(__dirname, `../${path}`)

const isDev = process.env.NODE_ENV === 'development'

const postcssOptions = {
  sourceMap: true,
  plugins: [['autoprefixer']],
}

module.exports = {
  entry: {
    main: './src/core/index.js',
    terminalEntry: './src/core/terminal.js',
  },
  moduleRules: [
    {
      test: /\.jsx?$/,
      include: root('src'),
      use: [
        {
          loader: 'thread-loader',
          options: {
            workers: require('os').cpus().length - 1 || 1,
          },
        },
        {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            plugins: isDev ? [require.resolve('react-refresh/babel')] : [],
          },
        },
      ],
    },
    {
      test: /\.tsx?$/,
      include: root('src'),
      use: {
        loader: 'ts-loader',
        options: {
          transpileOnly: true,
          getCustomTransformers: () => ({
            before: [styledComponentsTransformer]
          })
        },
      },
    },
    {
      test: /\.svg$/i,
      use: [
        {
          loader: '@svgr/webpack',
          options: {
            icon: true,
          },
        },
        'url-loader',
      ],
    },
    {
      test: /\.(jpg|png)(\?.+)?$/,
      include: root('src/assets'),
      type: 'asset',
      parser: {
        dataUrlCondition: {
          maxSize: 100 * 1024,
        },
      },
    },
    {
      test: /\.(js|jsx)$/,
      include: [root('src'), root('node_modules/react-sortablejs')],
      use: ['babel-loader'],
    },
    {
      test: /\.s[ac]ss$/i,
      include: root('src'),
      use: [
        isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
        {
          loader: 'css-loader',
          options: {
            importLoaders: 2,
            modules: {
              localIdentName: '[name]__[local]___[hash:base64:5]',
            },
            sourceMap: true,
          },
        },
        {
          loader: 'postcss-loader',
          options: {
            postcssOptions,
            sourceMap: true,
          },
        },
        {
          loader: 'sass-loader',
          options: {
            sassOptions: {
              quietDeps: true,
              sourceMap: true,
            },
          },
        },
      ],
    },
    {
      test: /\.s[ac]ss$/i,
      include: root('node_modules'),
      use: [
        isDev ? 'style-loader' : MiniCssExtractPlugin.loader,
        {
          loader: 'css-loader',
          options: {
            importLoaders: 2,
            sourceMap: true,
          },
        },
        {
          loader: 'postcss-loader',
          options: {
            postcssOptions,
            sourceMap: true,
          },
        },
        {
          loader: 'sass-loader',
          options: {
            sassOptions: {
              quietDeps: true,
              sourceMap: true,
              logger: require('sass').Logger.silent // 完全静默
            },
          },
        },
      ],
    },
    {
      test: /\.css$/,
      use: [isDev ? 'style-loader' : MiniCssExtractPlugin.loader, 'css-loader'],
    },
    {
      // fix ace-build worker-loader
      test: /ace-builds.*\/worker-.*$/,
      type: 'asset/resource',
    }
  ],
  resolve: {
    extensions: ['.js', '.jsx', '.scss', '.ts', '.tsx'],
    symlinks: false,
    modules: [root('src'), root('src/pages'), 'node_modules'],
    alias: {
      node_modules: root('node_modules'),
      '/assets': root('src/assets'),
    },
  },
  plugins: [
    new WebpackAssetsManifest({
      entrypoints: true,
      entrypointsUseAssets: true,
      writeToDisk: true,
      output: '../dist/manifest.json',
    }),
    new WebpackBar(),
  ],
}
