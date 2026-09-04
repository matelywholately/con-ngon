module.exports = function (api) {
  api.cache(true);
  return {
    presets: [['babel-preset-expo', { reactCompiler: true }]],
    // react-native-worklets/plugin supersedes the old reanimated plugin in
    // Reanimated 4. It must stay last in the list.
    plugins: ['react-native-worklets/plugin'],
  };
};
