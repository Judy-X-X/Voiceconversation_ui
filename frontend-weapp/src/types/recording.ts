export interface RecordingItem {
  id: number;
  name?: string;
  filename: string;
  size: number;
  content?: string;
  createdAt?: string;
  created_at?: string;
  tag_list?: string[];
  tag_ids?: number[];
}
