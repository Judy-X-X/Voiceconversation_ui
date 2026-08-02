import React, { useEffect, useRef, useState } from 'react';
import { Text, View } from '@tarojs/components';
import Taro, { useDidShow, usePullDownRefresh } from '@tarojs/taro';
import RecordCard from '@/components/RecordCard';
import { deleteRecording, fetchRecordings, renameRecording, transcribeRecording, updateRecordingContent } from '@/services/api';
import type { RecordingItem } from '@/types/recording';
import { getBaseUrl } from '@/utils/storage';
import styles from './index.module.scss';

const RecordsPage: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [recordings, setRecordings] = useState<RecordingItem[]>([]);
  const [playingId, setPlayingId] = useState<number | null>(null);
  const [transcribingId, setTranscribingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const audioRef = useRef<Taro.InnerAudioContext | null>(null);
  const pendingPlayIdRef = useRef<number | null>(null);
  const pendingPlaySrcRef = useRef('');

  useEffect(() => {
    const audio = Taro.createInnerAudioContext();
    audio.autoplay = false;
    audio.obeyMuteSwitch = false;

    audio.onCanplay(() => {
      if (!pendingPlayIdRef.current || !pendingPlaySrcRef.current) {
        return;
      }
      audio.play();
    });
    audio.onPlay(() => {
      if (pendingPlayIdRef.current) {
        setPlayingId(pendingPlayIdRef.current);
        pendingPlayIdRef.current = null;
      }
    });
    audio.onEnded(() => {
      pendingPlayIdRef.current = null;
      pendingPlaySrcRef.current = '';
      setPlayingId(null);
    });
    audio.onStop(() => {
      pendingPlayIdRef.current = null;
      pendingPlaySrcRef.current = '';
      setPlayingId(null);
    });
    audio.onError((error) => {
      console.error('[Records] play failed', error);
      pendingPlayIdRef.current = null;
      pendingPlaySrcRef.current = '';
      setPlayingId(null);
      Taro.showToast({ title: '无法播放音频', icon: 'none' });
    });

    audioRef.current = audio;

    return () => {
      audio.stop();
      audio.destroy();
      audioRef.current = null;
    };
  }, []);

  const getAudioUrl = (item: RecordingItem) => {
    return item.id ? `${getBaseUrl()}/recordings/${item.id}/media` : '';
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchRecordings();
      setRecordings(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error('[Records] fetch failed', error);
      Taro.showToast({
        title: error instanceof Error ? error.message : '加载失败',
        icon: 'none'
      });
      setRecordings([]);
    } finally {
      setLoading(false);
      Taro.stopPullDownRefresh();
    }
  };

  useDidShow(() => {
    loadData();
  });

  usePullDownRefresh(() => {
    loadData();
  });

  const handlePlay = (item: RecordingItem) => {
    if (!audioRef.current) {
      Taro.showToast({ title: '播放器初始化中', icon: 'none' });
      return;
    }

    if (playingId === item.id) {
      audioRef.current.stop();
      setPlayingId(null);
      return;
    }

    const audioUrl = getAudioUrl(item);
    if (!audioUrl) {
      Taro.showToast({ title: '录音地址无效', icon: 'none' });
      return;
    }

    pendingPlayIdRef.current = item.id;
    pendingPlaySrcRef.current = audioUrl;
    setPlayingId(null);

    if (playingId !== null) {
      audioRef.current.stop();
    }
    audioRef.current.src = audioUrl;
  };

  const handleRename = async (item: RecordingItem, name: string) => {
    try {
      await renameRecording(item.id, name);
      setRecordings((prev) => prev.map((record) => (record.id === item.id ? { ...record, name } : record)));
      Taro.showToast({ title: '名称已更新', icon: 'success' });
    } catch (error) {
      console.error('[Records] rename failed', error);
      Taro.showToast({
        title: error instanceof Error ? error.message : '更新失败',
        icon: 'none'
      });
    }
  };

  const handleTranscribe = async (item: RecordingItem) => {
    try {
      setTranscribingId(item.id);
      await transcribeRecording(item.id);
      Taro.showToast({ title: item.content ? '已重新翻译' : '转写成功', icon: 'success' });
      await loadData();
    } catch (error) {
      console.error('[Records] transcribe failed', error);
      Taro.showToast({
        title: error instanceof Error ? error.message : '转写失败',
        icon: 'none'
      });
    } finally {
      setTranscribingId(null);
    }
  };

  const handleDelete = async (item: RecordingItem) => {
    const modalRes = await Taro.showModal({
      title: '删除录音',
      content: `确定删除“${item.name || `录音 ${item.id}`}”吗？删除后无法恢复。`,
      confirmColor: '#d14c4c'
    });

    if (!modalRes.confirm) {
      return;
    }

    try {
      setDeletingId(item.id);
      await deleteRecording(item.id);
      if (playingId === item.id && audioRef.current) {
        audioRef.current.stop();
      }
      setRecordings((prev) => prev.filter((record) => record.id !== item.id));
      Taro.showToast({ title: '删除成功', icon: 'success' });
    } catch (error) {
      console.error('[Records] delete failed', error);
      Taro.showToast({
        title: error instanceof Error ? error.message : '删除失败',
        icon: 'none'
      });
    } finally {
      setDeletingId(null);
    }
  };

  const handleCorrect = async (item: RecordingItem, content: string) => {
    try {
      await updateRecordingContent(item.id, content);
      setRecordings((prev) => prev.map((record) => (record.id === item.id ? { ...record, content } : record)));
      Taro.showToast({ title: '已保存', icon: 'success' });
    } catch (error) {
      console.error('[Records] correct failed', error);
      Taro.showToast({
        title: error instanceof Error ? error.message : '保存失败',
        icon: 'none'
      });
    }
  };

  return (
    <View className={styles.page}>
      <Text className={styles.title}>🗂️ 录音记录</Text>

      {loading ? (
        <View className={styles.loading}>加载中...</View>
      ) : recordings.length === 0 ? (
        <View className={styles.empty}>暂无记录</View>
      ) : (
        <View className={styles.list}>
          {recordings.map((item) => (
            <RecordCard
              key={item.id}
              item={item}
              playingId={playingId}
              transcribingId={transcribingId}
              deletingId={deletingId}
              onPlay={handlePlay}
              onRename={handleRename}
              onTranscribe={handleTranscribe}
              onDelete={handleDelete}
              onCorrect={handleCorrect}
            />
          ))}
        </View>
      )}
    </View>
  );
};

export default RecordsPage;
