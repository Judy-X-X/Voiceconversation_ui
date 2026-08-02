import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Input, Text, View } from '@tarojs/components';
import Taro from '@tarojs/taro';
import classNames from 'classnames';
import { getBackendUrl, setBackendUrl } from '@/utils/storage';
import styles from './index.module.scss';

const DEFAULT_BARS = [18, 26, 22, 34, 28, 42, 24, 32, 20, 36, 26, 30];

const RecorderPage: React.FC = () => {
  const recorderRef = useRef(Taro.getRecorderManager());
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waveTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tempPathRef = useRef('');
  const uploadTaskRef = useRef<Taro.UploadTask | null>(null);

  const [backendUrl, setBackendUrlState] = useState(getBackendUrl());
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingName, setRecordingName] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [logText, setLogText] = useState('✨ 系统就绪，点击底部麦克风开始录音');
  const [bars, setBars] = useState(DEFAULT_BARS);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const recorder = recorderRef.current;

    recorder.onStop((result) => {
      console.info('[Recorder] stop', result);
      tempPathRef.current = result.tempFilePath;
      setIsRecording(false);
      setShowUpload(true);
      setRecordingName(`录音 ${new Date().toLocaleString()}`);
      setLogText('⏸️ 录音结束，已生成音频文件');
      stopWave();
      stopTimer();
    });

    recorder.onError((error) => {
      console.error('[Recorder] error', error);
      setIsRecording(false);
      setLogText('❌ 录音失败，请检查麦克风权限');
      stopWave();
      stopTimer();
    });

    return () => {
      stopWave();
      stopTimer();
      if (uploadTaskRef.current) {
        try {
          uploadTaskRef.current.abort();
        } catch (error) {
          console.error('[Recorder] abort upload failed', error);
        }
        uploadTaskRef.current = null;
      }
    };
  }, []);

  const timeText = useMemo(() => {
    const mins = Math.floor(recordingTime / 60);
    const secs = recordingTime % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }, [recordingTime]);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stopWave = () => {
    if (waveTimerRef.current) {
      clearInterval(waveTimerRef.current);
      waveTimerRef.current = null;
    }
    setBars(DEFAULT_BARS);
  };

  const startWave = () => {
    stopWave();
    waveTimerRef.current = setInterval(() => {
      setBars((prev) =>
        prev.map(() => {
          const next = Math.floor(Math.random() * 100) + 24;
          return next;
        })
      );
    }, 180);
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      recorderRef.current.stop();
      return;
    }

    try {
      await Taro.authorize({ scope: 'scope.record' });
    } catch (error) {
      console.error('[Recorder] authorize failed', error);
      Taro.showToast({ title: '请先开启录音权限', icon: 'none' });
      return;
    }

    try {
      recorderRef.current.start({
        duration: 600000,
        sampleRate: 16000,
        numberOfChannels: 1,
        encodeBitRate: 96000,
        format: 'mp3'
      });
      tempPathRef.current = '';
      setRecordingTime(0);
      setShowUpload(false);
      setRecordingName('');
      setIsRecording(true);
      setLogText('🎤 开始录音...');
      timerRef.current = setInterval(() => {
        setRecordingTime((prev) => prev + 1);
      }, 1000);
      startWave();
    } catch (error) {
      console.error('[Recorder] start failed', error);
      Taro.showToast({ title: '无法开始录音', icon: 'none' });
    }
  };

  const handleUpload = async () => {
    if (!tempPathRef.current) {
      Taro.showToast({ title: '没有可上传的录音', icon: 'none' });
      return;
    }

    try {
      setUploading(true);
      setLogText('⏳ 正在上传...');
      const result = await new Promise<{ id?: number }>((resolve, reject) => {
        const task = Taro.uploadFile({
          url: backendUrl.trim() || getBackendUrl(),
          filePath: tempPathRef.current,
          name: 'audio',
          formData: { name: recordingName.trim() || `录音 ${new Date().toLocaleString()}` },
          success(res) {
            uploadTaskRef.current = null;
            try {
              const data = JSON.parse(res.data || '{}') as { success?: boolean; id?: number; message?: string; error?: string };
              if (res.statusCode >= 400 || data.success === false) {
                reject(new Error(data.message || data.error || '上传失败'));
                return;
              }
              resolve({ id: data.id });
            } catch (error) {
              reject(error);
            }
          },
          fail(error) {
            uploadTaskRef.current = null;
            reject(error);
          }
        });
        uploadTaskRef.current = task;
      });
      setLogText(`✅ 上传成功! ID: ${result.id || '已完成'}`);
      setShowUpload(false);
      tempPathRef.current = '';
      setRecordingName('');
      Taro.showToast({ title: '上传成功', icon: 'success' });
    } catch (error) {
      console.error('[Recorder] upload failed', error);
      setLogText(`❌ 上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
      Taro.showToast({
        title: error instanceof Error ? error.message : '上传失败',
        icon: 'none'
      });
    } finally {
      setUploading(false);
    }
  };

  const handleCancelUpload = () => {
    if (uploadTaskRef.current) {
      try {
        uploadTaskRef.current.abort();
      } catch (error) {
        console.error('[Recorder] abort upload failed', error);
      }
      uploadTaskRef.current = null;
    }
    setUploading(false);
    setShowUpload(false);
    tempPathRef.current = '';
    setRecordingName('');
    setLogText('✅ 已取消上传');
  };

  const handleSaveBackendUrl = () => {
    setBackendUrl(backendUrl.trim() || getBackendUrl());
    setBackendUrlState(backendUrl.trim() || getBackendUrl());
    setLogText(`📡 后端地址设置为: ${backendUrl.trim() || getBackendUrl()}`);
    Taro.showToast({ title: '地址已更新', icon: 'success' });
  };

  return (
    <View className={styles.page}>
      <View className={styles.card}>
        <View className={styles.titleRow}>
          <View className={styles.titleIcon}>📱</View>
          <Text className={styles.title}>录音助手</Text>
        </View>
        <Text className={styles.subtitle}>点击下方按钮开始录音，结束后可直接命名并上传</Text>

        <View className={styles.visualizer}>
          <View className={styles.bars}>
            {bars.map((height, index) => (
              <View key={index} className={styles.bar} style={{ height: `${height}rpx` }} />
            ))}
          </View>

          <View className={styles.statusBar}>
            <View className={styles.statusText}>
              <View className={classNames(styles.led, isRecording && styles.ledActive)} />
              <Text>{isRecording ? '正在录音...' : '等待操作'}</Text>
            </View>
            <Text>{timeText}</Text>
          </View>
        </View>

        <View className={styles.micWrap}>
          <Button
            className={classNames(styles.micButton, isRecording && styles.micButtonRecording)}
            onClick={handleToggleRecording}
          >
            {isRecording ? '⏹' : '🎤'}
          </Button>
        </View>

        <View className={styles.actions}>
          {showUpload && (
            <Input
              className={styles.nameInput}
              type='text'
              value={recordingName}
              placeholder='录音名称'
              onInput={(event) => setRecordingName(event.detail.value)}
            />
          )}
          {showUpload && (
            <Button className={styles.uploadButton} loading={uploading} onClick={handleUpload}>
              💾 上传录音
            </Button>
          )}
          {showUpload && (
            <Button className={styles.cancelButton} disabled={false} onClick={handleCancelUpload}>
              取消上传
            </Button>
          )}
        </View>

        <View className={styles.logBox}>
          <Text>{logText}</Text>
        </View>

        <View className={styles.configCard}>
          <Text className={styles.configLabel}>后端地址（同一 Wi-Fi 下可改成局域网地址）</Text>
          <Input
            className={styles.configInput}
            type='text'
            value={backendUrl}
            placeholder='http://IP:3000/upload'
            onInput={(event) => setBackendUrlState(event.detail.value)}
          />
          <Button className={styles.configButton} onClick={handleSaveBackendUrl}>
            更新地址
          </Button>
        </View>
      </View>
    </View>
  );
};

export default RecorderPage;
