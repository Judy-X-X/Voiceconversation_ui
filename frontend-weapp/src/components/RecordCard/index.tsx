import React, { useMemo, useState } from 'react';
import { Button, Input, Text, Textarea, View } from '@tarojs/components';
import classNames from 'classnames';
import dayjs from 'dayjs';
import type { RecordingItem } from '@/types/recording';
import styles from './index.module.scss';

interface RecordCardProps {
  item: RecordingItem;
  playingId?: number | null;
  transcribingId?: number | null;
  deletingId?: number | null;
  onPlay: (item: RecordingItem) => void;
  onRename: (item: RecordingItem, name: string) => Promise<void> | void;
  onTranscribe: (item: RecordingItem) => Promise<void> | void;
  onDelete: (item: RecordingItem) => Promise<void> | void;
  onCorrect: (item: RecordingItem, content: string) => Promise<void> | void;
}

const RecordCard: React.FC<RecordCardProps> = ({
  item,
  playingId,
  transcribingId,
  deletingId,
  onPlay,
  onRename,
  onTranscribe,
  onDelete,
  onCorrect
}) => {
  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(item.name || `Recording #${item.id}`);
  const [correcting, setCorrecting] = useState(false);
  const [draftContent, setDraftContent] = useState(item.content || '');

  const metaText = useMemo(() => {
    const createdAt = item.createdAt || item.created_at || '';
    const dateText = createdAt ? dayjs(createdAt).format('YYYY/MM/DD HH:mm:ss') : '未知时间';
    const sizeText = `${(item.size / 1024).toFixed(1)} KB`;
    return `${dateText} · ${sizeText}`;
  }, [item.createdAt, item.created_at, item.size]);

  const handleSave = async () => {
    if (!draftName.trim()) {
      return;
    }
    await onRename(item, draftName.trim());
    setEditing(false);
  };

  const handleSaveContent = async () => {
    await onCorrect(item, draftContent);
    setCorrecting(false);
  };

  return (
    <View className={styles.card}>
      <View className={styles.info}>
        {!editing ? (
          <View className={styles.titleRow}>
            <Text className={styles.title}>{item.name || `Recording #${item.id}`}</Text>
            <Button className={styles.inlineAction} onClick={() => setEditing(true)}>
              ✎
            </Button>
          </View>
        ) : (
          <View className={styles.editRow}>
            <Input
              className={styles.input}
              type='text'
              value={draftName}
              onInput={(event) => setDraftName(event.detail.value)}
            />
            <Button className={classNames(styles.miniButton, styles.primaryButton)} onClick={handleSave}>
              保存
            </Button>
            <Button className={styles.miniButton} onClick={() => setEditing(false)}>
              取消
            </Button>
          </View>
        )}

        <Text className={styles.meta}>{metaText}</Text>

        {Array.isArray(item.tag_list) && item.tag_list.length > 0 ? (
          <View className={styles.tagWrap}>
            {item.tag_list.map((tg) => (
              <View key={tg} className={styles.tagBadge}>
                <Text className={styles.tagText}>🏷️ {tg}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {item.content ? (
          !correcting ? (
            <View className={styles.contentBox}>
              <View className={styles.contentHeader}>
                <Text className={styles.contentLabel}>📝</Text>
                <Button
                  className={classNames(styles.miniButton, styles.inlineContentAction)}
                  disabled={transcribingId === item.id || deletingId === item.id}
                  onClick={() => {
                    setDraftContent(item.content || '');
                    setCorrecting(true);
                  }}
                >
                  纠错
                </Button>
              </View>
              <Text className={styles.contentText}>{item.content}</Text>
            </View>
          ) : (
            <View className={styles.correctBox}>
              <Textarea
                className={styles.textarea}
                value={draftContent}
                maxlength={10000}
                autoHeight
                onInput={(event) => setDraftContent(event.detail.value)}
              />
              <View className={styles.correctActions}>
                <Button className={classNames(styles.miniButton, styles.actionButton)} onClick={() => setCorrecting(false)}>
                  取消
                </Button>
                <Button
                  className={classNames(styles.miniButton, styles.actionButton, styles.primaryButton)}
                  onClick={handleSaveContent}
                >
                  保存
                </Button>
              </View>
            </View>
          )
        ) : null}

        <View className={styles.actionRow}>
          <Button
            className={classNames(styles.miniButton, styles.actionButton, styles.primaryButton)}
            onClick={() => onTranscribe(item)}
            disabled={transcribingId === item.id || deletingId === item.id}
          >
            {transcribingId === item.id ? '翻译中...' : item.content ? '重新翻译' : '🔄 转文字'}
          </Button>
          <Button
            className={classNames(styles.miniButton, styles.actionButton, styles.dangerButton)}
            onClick={() => onDelete(item)}
            disabled={deletingId === item.id || transcribingId === item.id}
          >
            {deletingId === item.id ? '删除中...' : '删除录音'}
          </Button>
        </View>
      </View>

      <Button className={styles.playButton} onClick={() => onPlay(item)}>
        {playingId === item.id ? '⏸' : '▶'}
      </Button>
    </View>
  );
};

export default RecordCard;
