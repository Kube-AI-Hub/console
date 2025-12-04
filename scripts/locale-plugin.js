const logger = require('./logger')
const fs = require('fs')
const path = require('path')
const RawSource = require('webpack-sources/lib/RawSource')

const EXCLUDE_NAMES = ['scripts', 'node_modules', 'dist', 'en', '.DS_Store']

const langArr = fs
  .readdirSync(`./locales/`)
  .filter(
    lang =>
      !EXCLUDE_NAMES.includes(lang) &&
      fs.statSync(`./locales/${lang}`).isDirectory()
  )

const isDev = process.env.NODE_ENV === 'development'

class LocalePlugin {
  apply(compiler) {
    compiler.hooks.thisCompilation.tap('LocalePlugin', compilation => {
      compilation.hooks.processAssets.tap(
        {
          name: 'LocalePlugin',
          stage: compilation.constructor.PROCESS_ASSETS_STAGE_OPTIMIZE,
        },
        assets => {
          Object.keys(assets).forEach(assetName => {
            // skip manifest.json
            if (assetName.includes('manifest')) {
              return
            }
            logger.default.info(`building ${assetName}`)
            const asset = compilation.getAsset(assetName)
            if (!asset) {
              return
            }
            let content = asset.source.source()
            try {
              const obj = eval(`var global = {};${content}; global.locale`)
              if (obj.default) {
                content = JSON.stringify(
                  obj.default.reduce((prev, cur) => ({ ...prev, ...cur }), {})
                )
              }
              if (isDev) {
                if (!fs.existsSync(compiler.outputPath)) {
                  fs.mkdirSync(compiler.outputPath, { recursive: true })
                }
                fs.writeFileSync(
                  path.join(compiler.outputPath, assetName),
                  content
                )
              }
            } catch (error) {
              logger.default.error(`${assetName} build error`, error)
            }

            compilation.updateAsset(assetName, new RawSource(content))
          })

          langArr.forEach(lang => {
            only(lang)
          })

          isExistFilesInEN()
        }
      )
    })
  }
}

function read(lang) {
  const files = fs.readdirSync(`locales/${lang}`)
  return files
}

function only(lang) {
  const files = read(lang)

  const allKeyArr = []

  files.forEach(file => {
    if (file === 'index.js') {
      return
    }

    const fileObj = require(`../locales/${lang}/${file}`)

    Object.keys(fileObj).forEach(key => {
      if (allKeyArr.indexOf(key) > -1) {
        logger.default.warn(`${lang} duplicate UI terms in the language environment: ${key}`)
      } else {
        allKeyArr.push(key)
      }
    })
  })
}

const isExistFilesInEN = () => {
  const enFiles = read('en')

  langArr.forEach(lang => {
    const files = read(lang)
    files.forEach(file => {
      const isExist = enFiles.indexOf(file)

      if (isExist < 0) {
        logger.default.warn(`${lang} file not synchronized with en: ${file}`)
      }
    })
  })
}

module.exports = LocalePlugin
