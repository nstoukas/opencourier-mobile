module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    'react-native-reanimated/plugin',
    'add-react-displayname',
    [
      'module-resolver',
      {
        root: ['./'],
        alias: {
          '@app': './src',
        },
      },
    ],
    [
      'module:react-native-dotenv',
      {
        moduleName: '@env',
        path: '.env',
        blacklist: null,
        whitelist: null,
        safe: false,
        allowUndefined: true,
      },
    ],
  ],
};
