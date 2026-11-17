import { GoogleSignin, isSuccessResponse } from '@react-native-google-signin/google-signin';
import * as AppleAuthentication from 'expo-apple-authentication';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const googleWebClientId = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID?.trim();
const googleIosClientId = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID?.trim();

function configureGoogle() {
  if (!googleWebClientId || (Platform.OS === 'ios' && (!googleIosClientId || !Constants.expoConfig?.extra?.iosGoogleConfigured))) {
    throw new Error('A entrada com Google não está disponível nesta versão.');
  }
  GoogleSignin.configure({ webClientId: googleWebClientId, iosClientId: googleIosClientId });
}

export async function googleIdentity() {
  configureGoogle();
  if (Platform.OS === 'android') {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  }
  const result = await GoogleSignin.signIn();
  if (!isSuccessResponse(result)) {
    return null;
  }
  if (!result.data.idToken) {
    throw new Error('O Google não confirmou sua entrada. Tente novamente.');
  }
  return { idToken: result.data.idToken, name: result.data.user.name };
}

export async function appleIdentity() {
  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [AppleAuthentication.AppleAuthenticationScope.FULL_NAME, AppleAuthentication.AppleAuthenticationScope.EMAIL],
    });
    if (!credential.identityToken) {
      throw new Error('A Apple não confirmou sua entrada. Tente novamente.');
    }
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ');
    return { idToken: credential.identityToken, name: name || null };
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ERR_REQUEST_CANCELED') {
      return null;
    }
    throw error;
  }
}

export async function forgetGoogleSignIn() {
  configureGoogle();
  await GoogleSignin.signOut();
}
