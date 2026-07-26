import Taro from '@tarojs/taro';
import type { UserInfo } from '@/types/user';

const BACKEND_URL_KEY = 'voice_backend_url';
const USER_KEY = 'voice_current_user';

const LEGACY_LOCALHOST_URL = 'http://localhost:3000/upload';
const LEGACY_VMWARE_URL = 'http://192.168.30.1:3000/upload';
export const DEFAULT_BACKEND_URL = 'http://10.202.2.32:3000/upload';

export const getBackendUrl = () => {
  const storedUrl = Taro.getStorageSync(BACKEND_URL_KEY);
  if (!storedUrl || storedUrl === LEGACY_LOCALHOST_URL || storedUrl === LEGACY_VMWARE_URL) {
    Taro.setStorageSync(BACKEND_URL_KEY, DEFAULT_BACKEND_URL);
    return DEFAULT_BACKEND_URL;
  }
  return storedUrl;
};

export const setBackendUrl = (url: string) => {
  Taro.setStorageSync(BACKEND_URL_KEY, url);
};

export const getBaseUrl = () => {
  return getBackendUrl().replace(/\/upload$/, '');
};

export const getCurrentUser = (): UserInfo | null => {
  return Taro.getStorageSync(USER_KEY) || null;
};

export const setCurrentUser = (user: UserInfo | null) => {
  if (user) {
    Taro.setStorageSync(USER_KEY, user);
    return;
  }
  Taro.removeStorageSync(USER_KEY);
};
