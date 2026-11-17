module.exports = ({ config }) => {
  const iosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();
  const googleServicesFile = process.env.GOOGLE_SERVICES_JSON?.trim();
  const plugins = [...config.plugins];

  if (iosClientId) {
    const client = iosClientId.match(/^([\w-]+)\.apps\.googleusercontent\.com$/);
    if (!client) {
      throw new Error('EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID deve ser um ID de cliente OAuth do iOS.');
    }
    plugins.push(['@react-native-google-signin/google-signin', { iosUrlScheme: `com.googleusercontent.apps.${client[1]}` }]);
  }

  return {
    ...config,
    plugins,
    android: { ...config.android, googleServicesFile },
    extra: { ...config.extra, androidPushConfigured: !!googleServicesFile, iosGoogleConfigured: !!iosClientId },
  };
};
