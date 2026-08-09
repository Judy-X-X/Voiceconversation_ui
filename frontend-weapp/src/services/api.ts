import Taro from '@tarojs/taro';
import type { RecordingItem } from '@/types/recording';
import type { UserInfo } from '@/types/user';
import { getBackendUrl, getBaseUrl, getCurrentUser, setCurrentUser } from '@/utils/storage';

interface ApiResponse<T = unknown> {
  success?: boolean;
  message?: string;
  error?: string;
  id?: number;
  user?: UserInfo;
  text?: string;
  data?: T;
  total?: number;
}

export interface VoiceTagItem {
  id: number;
  name: string;
}

const request = async <T = unknown>(
  path: string,
  options: Partial<Parameters<typeof Taro.request>[0]> = {}
): Promise<T> => {
  const currentUser = getCurrentUser();
  const response = await Taro.request<T & ApiResponse>({
    url: `${getBaseUrl()}${path}`,
    method: options.method || 'GET',
    data: options.data,
    enableCookie: true,
    header: {
      'content-type': 'application/json',
      ...(currentUser?.id ? { 'X-User-Id': String(currentUser.id) } : {}),
      ...(options.header || {})
    }
  });

  const data = response.data as T & ApiResponse;
  if (response.statusCode >= 400) {
    throw new Error(data?.message || data?.error || `请求失败: ${response.statusCode}`);
  }

  return data;
};

export const loginUser = async (phone: string, password: string) => {
  const data = await request<ApiResponse>('/api/user/login', {
    method: 'POST',
    data: { phone, password }
  });

  if (!data.success || !data.user) {
    throw new Error(data.message || '用户名或密码错误');
  }

  setCurrentUser(data.user);
  return data.user;
};

export const registerUser = async (phone: string, password: string) => {
  const data = await request<ApiResponse>('/api/user/register', {
    method: 'POST',
    data: { phone, password }
  });

  if (!data.success || !data.user) {
    throw new Error(data.message || '注册失败');
  }

  return data.user;
};

export const logoutUser = async () => {
  try {
    await request<ApiResponse>('/api/user/logout', { method: 'POST' });
  } catch (error) {
    console.error('[Auth] logout failed', error);
  } finally {
    setCurrentUser(null);
  }
};

export const fetchCurrentUser = async () => {
  const currentUser = getCurrentUser();
  const query = currentUser?.id ? `?userId=${currentUser.id}` : '';
  const data = await request<ApiResponse>(`/api/user/current${query}`);
  if (!data.success || !data.user) {
    throw new Error(data.message || '未登录');
  }
  setCurrentUser(data.user);
  return data.user;
};

export const updateUserProfile = async (payload: Partial<UserInfo>) => {
  const currentUser = getCurrentUser();
  const data = await request<ApiResponse>('/api/user/update', {
    method: 'PUT',
    data: {
      ...payload,
      ...(currentUser?.id ? { userId: String(currentUser.id) } : {})
    }
  });

  if (!data.success || !data.user) {
    throw new Error(data.message || '保存失败');
  }

  setCurrentUser(data.user);
  return data.user;
};

export const fetchRecordings = async () => {
  return request<RecordingItem[]>('/recordings');
};

export const fetchVoiceTags = async () => {
  const data = await request<ApiResponse>('/tags');
  if (!data.success) {
    throw new Error(data.message || '加载标签失败');
  }
  return Array.isArray(data.data) ? (data.data as VoiceTagItem[]) : [];
};

export const createVoiceTag = async (name: string) => {
  const trimmed = (name || '').trim();
  if (!trimmed) {
    throw new Error('标签不能为空');
  }
  const data = await request<ApiResponse>('/tags', {
    method: 'POST',
    data: { name: trimmed }
  });
  if (!data.success) {
    throw new Error(data.message || '新增标签失败');
  }
  return data.data as VoiceTagItem;
};

export const renameRecording = async (id: number, name: string) => {
  return request<ApiResponse>(`/recordings/${id}`, {
    method: 'PUT',
    data: { name }
  });
};

export const transcribeRecording = async (id: number) => {
  return request<ApiResponse>(`/recordings/${id}/transcribe`, {
    method: 'POST'
  });
};

export const deleteRecording = async (id: number) => {
  return request<ApiResponse>(`/recordings/${id}`, {
    method: 'DELETE'
  });
};

export const updateRecordingContent = async (id: number, content: string) => {
  return request<ApiResponse>(`/recordings/${id}/content`, {
    method: 'PUT',
    data: { content }
  });
};

export const uploadRecording = async (filePath: string, name: string, tagIds: number[] = []) => {
  return new Promise<ApiResponse>((resolve, reject) => {
    Taro.uploadFile({
      url: getBackendUrl(),
      filePath,
      name: 'audio',
      formData: { name, ...(tagIds.length > 0 ? { tag_ids: tagIds.join(',') } : {}) },
      success(res) {
        try {
          const data = JSON.parse(res.data || '{}') as ApiResponse;
          if (res.statusCode >= 400 || data.success === false) {
            reject(new Error(data.message || data.error || '上传失败'));
            return;
          }
          resolve(data);
        } catch (error) {
          reject(error);
        }
      },
      fail(error) {
        reject(error);
      }
    });
  });
};

export const fetchNotifications = async (page = 1, pageSize = 20) => {
  const data = await request<ApiResponse>(`/api/user/notifications?page=${page}&pageSize=${pageSize}`);
  if (!data.success) {
    throw new Error(data.message || '加载失败');
  }
  return Array.isArray(data.data) ? (data.data as unknown[]) : [];
};

export const markNotificationRead = async (id: number) => {
  const data = await request<ApiResponse>(`/api/user/notifications/${id}/read`, {
    method: 'PUT'
  });
  if (!data.success) {
    throw new Error(data.message || '操作失败');
  }
  return data;
};
