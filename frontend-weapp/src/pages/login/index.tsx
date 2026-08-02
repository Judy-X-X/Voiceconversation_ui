import React, { useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro, { useLoad } from '@tarojs/taro';
import { loginUser, registerUser } from '@/services/api';
import { getCurrentUser } from '@/utils/storage';
import styles from './index.module.scss';

const LoginPage: React.FC = () => {
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useLoad(() => {
    if (getCurrentUser()) {
      Taro.switchTab({ url: '/pages/records/index' });
    }
  });

  const handleSubmit = async () => {
    if (!phone.trim() || !password.trim()) {
      Taro.showToast({ title: '请输入手机号和密码', icon: 'none' });
      return;
    }

    try {
      setSubmitting(true);
      if (authMode === 'register') {
        await registerUser(phone.trim(), password);
      }
      await loginUser(phone.trim(), password);
      Taro.showToast({ title: authMode === 'register' ? '注册成功' : '登录成功', icon: 'success' });
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
        <Text className={styles.title}>{authMode === 'login' ? '欢迎登录' : '注册账号'}</Text>

        <View className={styles.field}>
          <Text className={styles.label}>手机号</Text>
          <Input
            className={styles.input}
            type='text'
            value={phone}
            placeholder='请输入手机号'
            onInput={(event) => setPhone(event.detail.value)}
          />
        </View>

        <View className={styles.field}>
          <Text className={styles.label}>密码</Text>
          <Input
            className={styles.input}
            type='password'
            password
            value={password}
            placeholder='请输入密码'
            onInput={(event) => setPassword(event.detail.value)}
          />
        </View>

        <Button className={styles.submit} loading={submitting} onClick={handleSubmit}>
          {authMode === 'login' ? '登录' : '注册'}
        </Button>
        <Button
          className={styles.switchMode}
          disabled={submitting}
          onClick={() => setAuthMode((prev) => (prev === 'login' ? 'register' : 'login'))}
        >
          {authMode === 'login' ? '没有账号？去注册' : '已有账号？去登录'}
        </Button>
        <Text className={styles.hint}>录音、记录、转文字功能会复用现有后端接口</Text>
      </View>
    </View>
  );
};

export default LoginPage;
