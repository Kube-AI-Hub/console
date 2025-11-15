module.exports = {
  plugins: [
    require('autoprefixer'),
    require('postcss-preset-env')({
      // 选项
      stage: 3, // 使用第3阶段的特性
      features: {
        'nesting-rules': true, // 启用CSS嵌套规则
      },
    }),
  ],
}
