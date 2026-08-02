import React, { useMemo, useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useDidShow } from '@tarojs/taro';
import { fetchCurrentUser, logoutUser, updateUserProfile } from '@/services/api';
import type { UserInfo } from '@/types/user';
import { getCurrentUser } from '@/utils/storage';
import styles from './index.module.scss';

const roleOptions = ['普通用户', '管理员'];
const avatarOptions = [
  { value: 'glasses', label: '👓' },
  { value: 'smile', label: '😀' },
  { value: 'happy', label: '😊' },
  { value: 'star', label: '🌟' },
  { value: 'panda', label: '🐼' },
  { value: 'cat', label: '🐱' },
  { value: 'headset', label: '🎧' },
  { value: 'book', label: '📚' }
];

const normalizeUser = (user: UserInfo | null): UserInfo | null => {
  if (!user) {
    return null;
  }

  return {
    ...user,
    nickname: user.nickname || user.username || '未命名用户',
    avatar: user.avatar || '',
    role: user.role === '管理员' ? '管理员' : '普通用户',
    phone: user.phone || '',
    createdAt: user.createdAt || user.created_at || ''
  };
};

const getAvatarLabelByValue = (value?: string) => {
  return avatarOptions.find((item) => item.value === value)?.label || '';
};

const MinePage: React.FC = () => {
  const [user, setUser] = useState<UserInfo | null>(normalizeUser(getCurrentUser()));
  const [profileDialogVisible, setProfileDialogVisible] = useState(false);
  const [profileDialogMode, setProfileDialogMode] = useState('');
  const [profileDialogTitle, setProfileDialogTitle] = useState('');
  const [profileDialogValue, setProfileDialogValue] = useState('');
  const [profileDialogValue2, setProfileDialogValue2] = useState('');

  useDidShow(() => {
    fetchCurrentUser()
      .then((nextUser) => setUser(normalizeUser(nextUser)))
      .catch((error) => {
        console.info('[Mine] use local user', error);
        setUser(normalizeUser(getCurrentUser()));
      });
  });

  const displayName = useMemo(() => {
    return user?.nickname || user?.username || '未登录用户';
  }, [user?.nickname, user?.username]);

  const avatarText = useMemo(() => {
    return getAvatarLabelByValue(user?.avatar) || displayName.slice(0, 1) || 'U';
  }, [displayName, user?.avatar]);

  const openProfileDialog = (mode: 'nickname' | 'avatar' | 'role' | 'phone' | 'password') => {
    setProfileDialogMode(mode);
    setProfileDialogValue('');
    setProfileDialogValue2('');

    if (mode === 'role') {
      setProfileDialogTitle('设置角色');
      setProfileDialogValue(user?.role || '普通用户');
    } else if (mode === 'nickname') {
      setProfileDialogTitle('修改名字');
      setProfileDialogValue(user?.nickname || '');
    } else if (mode === 'avatar') {
      setProfileDialogTitle('修改头像');
      setProfileDialogValue(user?.avatar || avatarOptions[0].value);
    } else if (mode === 'phone') {
      setProfileDialogTitle('更换手机号');
      setProfileDialogValue(user?.phone || '');
    } else {
      setProfileDialogTitle('修改密码');
    }

    setProfileDialogVisible(true);
  };

  const closeProfileDialog = () => {
    setProfileDialogVisible(false);
  };

  const submitProfileDialog = async () => {
    if (!user?.id && !user?.username) {
      Taro.showToast({ title: '请先登录', icon: 'none' });
      return;
    }

    const payload: Partial<UserInfo> = {};

    if (profileDialogMode === 'role') {
      payload.role = profileDialogValue;
    }
    if (profileDialogMode === 'nickname') {
      if (!profileDialogValue.trim()) {
        Taro.showToast({ title: '请输入名字', icon: 'none' });
        return;
      }
      payload.nickname = profileDialogValue.trim();
    }
    if (profileDialogMode === 'avatar') {
      if (!profileDialogValue) {
        Taro.showToast({ title: '请选择头像', icon: 'none' });
        return;
      }
      payload.avatar = profileDialogValue;
    }
    if (profileDialogMode === 'phone') {
      if (!profileDialogValue.trim()) {
        Taro.showToast({ title: '请输入手机号', icon: 'none' });
        return;
      }
      payload.phone = profileDialogValue.trim();
    }
    if (profileDialogMode === 'password') {
      if (!profileDialogValue || !profileDialogValue2) {
        Taro.showToast({ title: '请填写完整密码', icon: 'none' });
        return;
      }
      if (profileDialogValue !== profileDialogValue2) {
        Taro.showToast({ title: '两次密码不一致', icon: 'none' });
        return;
      }
      payload.password = profileDialogValue;
    }

    try {
      const nextUser = await updateUserProfile(payload);
      setUser(normalizeUser(nextUser));
      Taro.showToast({ title: '保存成功', icon: 'success' });
      closeProfileDialog();
    } catch (error) {
      console.error('[Mine] submit dialog failed', error);
      Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none'
      });
    }
  };

  const unbindPhone = async () => {
    try {
      const nextUser = await updateUserProfile({ phone: '' });
      setUser(normalizeUser(nextUser));
      Taro.showToast({ title: '已解绑', icon: 'success' });
    } catch (error) {
      console.error('[Mine] unbind phone failed', error);
      Taro.showToast({
        title: error instanceof Error ? error.message : '解绑失败',
        icon: 'none'
      });
    }
  };

  const handleLogout = async () => {
    await logoutUser();
    setUser(null);
    Taro.reLaunch({ url: '/pages/login/index' });
  };

  return (
    <View className={styles.page}>
      <View className={styles.profileCard}>
        <Button className={styles.avatarButton} onClick={() => openProfileDialog('avatar')}>
          <Text>{avatarText}</Text>
        </Button>
        <View className={styles.profileMain}>
          <Text className={styles.name}>{displayName}</Text>
          <View className={styles.profileLinks}>
            <Button className={styles.linkBtn} onClick={() => openProfileDialog('nickname')}>
              修改名字
            </Button>
            <Button className={styles.linkBtn} onClick={() => openProfileDialog('avatar')}>
              修改头像
            </Button>
          </View>
        </View>
      </View>

      <View className={styles.profileTabs}>
        <Button className={styles.profileTabActive}>账户信息</Button>
      </View>

      <View className={styles.panel}>
        <Text className={styles.panelTitle}>账号设置</Text>

        <View className={styles.row}>
          <Text className={styles.label}>账号</Text>
          <Text className={styles.value}>{user?.username || '未登录'}</Text>
          <View />
        </View>

        <View className={styles.row}>
          <Text className={styles.label}>所属角色</Text>
          <Text className={styles.value}>{user?.role || '普通用户'}</Text>
          <View className={styles.actions}>
            <Button className={styles.linkBtn} onClick={() => openProfileDialog('role')}>
              去设置
            </Button>
          </View>
        </View>

        <View className={styles.row}>
          <Text className={styles.label}>手机号</Text>
          <Text className={styles.value}>{user?.phone || '未绑定'}</Text>
          <View className={styles.actions}>
            <Button className={styles.linkBtn} onClick={() => openProfileDialog('phone')}>
              更换手机号
            </Button>
            {!!user?.phone && (
              <Button className={styles.linkBtn} onClick={unbindPhone}>
                解绑
              </Button>
            )}
          </View>
        </View>

        <View className={styles.row}>
          <Text className={styles.label}>密码</Text>
          <Text className={styles.value}>******</Text>
          <View className={styles.actions}>
            <Button className={styles.linkBtn} onClick={() => openProfileDialog('password')}>
              修改密码
            </Button>
          </View>
        </View>

        <View className={styles.row}>
          <Text className={styles.label}>站内消息</Text>
          <Text className={styles.value}>查看管理员通知</Text>
          <View className={styles.actions}>
            <Button className={styles.linkBtn} onClick={() => Taro.navigateTo({ url: '/pages/notifications/index' })}>
              查看
            </Button>
          </View>
        </View>
      </View>

      <Button className={styles.logoutBtn} onClick={handleLogout}>
        退出登录
      </Button>

      {profileDialogVisible && (
        <View className={styles.dialogMask} onClick={closeProfileDialog}>
          <View className={styles.dialogCard} onClick={(event) => event.stopPropagation()}>
            <Text className={styles.dialogTitle}>{profileDialogTitle}</Text>

            {profileDialogMode === 'role' && (
              <View className={styles.rolePicker}>
                {roleOptions.map((role) => (
                  <Button
                    key={role}
                    className={profileDialogValue === role ? styles.roleOptionActive : styles.roleOption}
                    onClick={() => setProfileDialogValue(role)}
                  >
                    {role}
                  </Button>
                ))}
              </View>
            )}

            {profileDialogMode === 'avatar' && (
              <View className={styles.avatarPicker}>
                {avatarOptions.map((avatar) => (
                  <Button
                    key={avatar.value}
                    className={profileDialogValue === avatar.value ? styles.avatarOptionActive : styles.avatarOption}
                    onClick={() => setProfileDialogValue(avatar.value)}
                  >
                    {avatar.label}
                  </Button>
                ))}
              </View>
            )}

            {profileDialogMode === 'nickname' && (
              <Input
                className={styles.dialogInput}
                type='text'
                value={profileDialogValue}
                placeholder='请输入新的名字'
                onInput={(event) => setProfileDialogValue(event.detail.value)}
              />
            )}

            {profileDialogMode === 'phone' && (
              <Input
                className={styles.dialogInput}
                type='number'
                value={profileDialogValue}
                placeholder='请输入新的手机号'
                onInput={(event) => setProfileDialogValue(event.detail.value)}
              />
            )}

            {profileDialogMode === 'password' && (
              <>
                <Input
                  className={styles.dialogInput}
                  type='text'
                  password
                  value={profileDialogValue}
                  placeholder='请输入新密码'
                  onInput={(event) => setProfileDialogValue(event.detail.value)}
                />
                <Input
                  className={styles.dialogInput}
                  type='text'
                  password
                  value={profileDialogValue2}
                  placeholder='请再次输入新密码'
                  onInput={(event) => setProfileDialogValue2(event.detail.value)}
                />
              </>
            )}

            <View className={styles.dialogActions}>
              <Button className={styles.dialogBtnSecondary} onClick={closeProfileDialog}>
                取消
              </Button>
              <Button className={styles.dialogBtnPrimary} onClick={submitProfileDialog}>
                保存
              </Button>
            </View>
          </View>
        </View>
      )}
    </View>
  );
};

export default MinePage;
