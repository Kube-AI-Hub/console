const { resolve } = require("path");

module.exports = {
  core: { builder: "webpack5" },
  stories: [
    "./stories/Intro.stories.mdx",
    "./stories/Foundation/*.stories.(js|tsx|mdx)",
    "./stories/Layout/*.stories.(js|tsx|mdx)",
    "./stories/Components/*.stories.(js|tsx|mdx)",
  ],
  addons: ["@storybook/addon-docs", "@storybook/addon-postcss"],
  webpackFinal: async (config) => {
    // disable webpack filesystem cache to avoid shutdown errors under Node 22
    config.cache = false;
    // handle scss and css in preview
    config.module.rules.push(
      {
        test: /\.scss$/,
        use: ["style-loader", "css-loader", "sass-loader"],
      },
      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      }
    );
    config.resolve.alias = {
      ...config.resolve.alias,
      components: resolve(__dirname, "../src/components"),
      "@storybook/blocks": resolve(__dirname, "./blocks-compat.js"),
    };
    return config;
  },
};
