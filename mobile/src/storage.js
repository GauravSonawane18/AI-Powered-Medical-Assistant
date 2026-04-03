import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'medassist_token';
const USER_KEY = 'medassist_user';

export async function getToken() {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function saveSession(token, user) {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, token],
    [USER_KEY, JSON.stringify(user)],
  ]);
}

export async function clearSession() {
  await AsyncStorage.multiRemove([TOKEN_KEY, USER_KEY]);
}

export async function loadSession() {
  const [[, token], [, userRaw]] = await AsyncStorage.multiGet([TOKEN_KEY, USER_KEY]);
  const user = userRaw ? JSON.parse(userRaw) : null;
  return { token, user };
}
