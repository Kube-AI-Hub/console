const classFeaturePlugins = [
  ["@babel/plugin-proposal-class-properties", { loose: true }],
  ["@babel/plugin-proposal-private-methods", { loose: true }],
  ["@babel/plugin-proposal-private-property-in-object", { loose: true }],
];

const envPreset = (options = {}) => [
  "@babel/env",
  { loose: true, ...options },
];

module.exports = (params) => {
  if (params.env("test")) {
    return {
      presets: [envPreset(), "@babel/react"],
      plugins: [...classFeaturePlugins],
    };
  }

  if (params.env() === "cjs") {
    return {
      presets: [envPreset(), "@babel/react"],
      plugins: [...classFeaturePlugins, "@babel/plugin-transform-runtime"],
    };
  }

  return {
    presets: [envPreset({ modules: false }), "@babel/react"],
    plugins: [
      ...classFeaturePlugins,
      ["@babel/plugin-transform-runtime", { useESModules: true }],
    ],
  };
};
