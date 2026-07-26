import React, { useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { loginUser } from '@/services/api';
import { getCurrentUser } from '@/utils/storage';
import styles from './index.module.scss';

const LoginPage: React.FC = () => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('123456');
  const [submitting, setSubmitting] = useState(false);

  useLoad(() => {
    if (getCurrentUser()) {
      Taro.switchTab({ url: '/pages/records/index' });
    }
  });

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      Taro.showToast({ title: '请输入账号密码', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      await loginUser(username.trim(), password);
      Taro.showToast({ title: '登录成功', icon: 'success' });
      setTimeout(() => {
        Taro.switchTab({ url: '/pages/records/index' });
      }, 250);
    } catch (error) {
      console.error('[Login] failed', error);
      Taro.showToast({
        title: error instanceof Error ? error.message : '登录失败',
        icon: 'none'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View className={styles.page}>
      <View className={styles.card}>
        <Text className={styles.title}>欢迎登录</Text>

        <View className={styles.field}>
          <Text className={styles.label}>账号</Text>
          <Input
            className={styles.input}
            type='text'
            value={username}
            placeholder='admin'
            onInput={(event) => setUsername(event.detail.value)}
          />
        </View>

        <View className={styles.field}>
          <Text className={styles.label}>密码</Text>
          <Input
            className={styles.input}
            type='password'
            password
            value={password}
            placeholder='123456'
            onInput={(event) => setPassword(event.detail.value)}
          />
        </View>

        <Button className={styles.submit} loading={submitting} onClick={handleLogin}>
          登录
        </Button>
        <Text className={styles.hint}>录音、记录、转文字功能会复用现有后端接口</Text>
      </View>
    </View>
  );
};

export default LoginPage;
