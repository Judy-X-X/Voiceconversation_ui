<script setup>
import { ref, onMounted, nextTick } from 'vue'

const backendUrl = ref('http://localhost:3000/upload')
const currentView = ref('login')
const loginAnimating = ref(false)
const recordings = ref([])
const username = ref('')
const password = ref('')
const currentUser = ref(null)

let mediaStream = null
let mediaRecorder = null
let audioChunks = []
let recordingStartTime = 0
let timerInterval = null
let analyser = null
let dataArray = null
let animationFrame = null
let currentAudio = null

const isRecording = ref(false)
const recordingName = ref('')
const showUploadConfig = ref(false)
const logMessage = ref('✨ 系统就绪，点击底部麦克风开始录音')
const recordingTimeDisplay = ref('0:00')
const canvasRef = ref(null)
const ctx = ref(null)
const activeProfileTab = ref('account')
const profileDialogVisible = ref(false)
const profileDialogMode = ref('')
const profileDialogTitle = ref('')
const profileDialogValue = ref('')
const profileDialogValue2 = ref('')
const transcribingIds = ref([])
const deletingIds = ref([])
const roleOptions = ['普通用户', '管理员']
const avatarOptions = [
  { value: 'glasses', label: '👓' },
  { value: 'smile', label: '😀' },
  { value: 'happy', label: '😊' },
  { value: 'star', label: '🌟' },
  { value: 'panda', label: '🐼' },
  { value: 'cat', label: '🐱' },
  { value: 'headset', label: '🎧' },
  { value: 'book', label: '📚' }
]

const getBaseUrl = () => {
  return backendUrl.value.replace('/upload', '')
}

const apiFetch = (path, options = {}) => {
  const config = {
    credentials: 'include',
    ...options
  }
  if (options.headers) {
    config.headers = options.headers
  }
  return fetch(`${getBaseUrl()}${path}`, config)
}

const normalizeUser = (user = {}) => ({
  id: user.id ?? null,
  username: user.username ?? '',
  password: user.password ?? '',
  nickname: user.nickname || user.username || '未命名用户',
  avatar: user.avatar || '',
  role: user.role === '管理员' ? '管理员' : '普通用户',
  phone: user.phone || '',
  createdAt: user.createdAt || user.created_at || ''
})

const getAvatarLabelByValue = (value) => {
  const matched = avatarOptions.find(item => item.value === value)
  return matched ? matched.label : ''
}

const appendLog = (msg) => {
  logMessage.value = msg
  console.log('[LOG]', msg)
}

const setBackendUrl = () => {
  appendLog(`📡 后端地址设置为: ${backendUrl.value}`)
}

const loadCurrentUser = async (silent = false) => {
  try {
    const res = await apiFetch('/api/user/current')
    const data = await res.json()
    if (res.ok && data.success && data.user) {
      currentUser.value = normalizeUser(data.user)
      return true
    }
    currentUser.value = null
    if (!silent) {
      appendLog(`⚠️ ${data.message || '未登录'}`)
    }
    return false
  } catch (e) {
    currentUser.value = null
    if (!silent) {
      appendLog('❌ 获取用户信息失败: ' + e.message)
    }
    return false
  }
}

const login = async () => {
  if (!username.value.trim() || !password.value.trim()) {
    alert('请输入账号和密码')
    return
  }

  try {
    const res = await apiFetch('/api/user/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: username.value.trim(),
        password: password.value
      })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || '登录失败')
    }

    currentUser.value = normalizeUser(data.user)
    loginAnimating.value = true
    setTimeout(() => {
      currentView.value = 'records'
      loginAnimating.value = false
    }, 300)
  } catch (e) {
    alert('登录失败: ' + e.message)
  }
}

const showRecorder = () => {
  currentView.value = 'recorder'
}

const showRecords = async () => {
  currentView.value = 'records'
  await loadRecordings()
}

const showMine = async () => {
  await loadCurrentUser(true)
  currentView.value = 'mine'
}

const loadRecordings = async () => {
  try {
    const res = await apiFetch('/recordings')
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || data.message || `HTTP ${res.status}`)
    }
    recordings.value = Array.isArray(data) ? data : []
  } catch (e) {
    console.error(e)
    recordings.value = []
    appendLog('❌ 加载失败: ' + e.message)
  }
}

const markPending = (targetRef, id) => {
  if (!targetRef.value.includes(id)) {
    targetRef.value = [...targetRef.value, id]
  }
}

const clearPending = (targetRef, id) => {
  targetRef.value = targetRef.value.filter(itemId => itemId !== id)
}

const isTranscribing = (id) => transcribingIds.value.includes(id)

const isDeleting = (id) => deletingIds.value.includes(id)

const drawSilent = () => {
  if (!ctx.value) return
  ctx.value.clearRect(0, 0, 360, 120)
  ctx.value.fillStyle = '#0f1e2f'
  ctx.value.fillRect(0, 0, 360, 120)
  ctx.value.beginPath()
  ctx.value.strokeStyle = '#2d5a7a'
  ctx.value.lineWidth = 1.5
  ctx.value.moveTo(0, 60)
  ctx.value.lineTo(360, 60)
  ctx.value.stroke()
}

const drawWave = () => {
  if (!analyser || !dataArray || !ctx.value) {
    drawSilent()
    return
  }
  analyser.getByteTimeDomainData(dataArray)
  ctx.value.clearRect(0, 0, 360, 120)
  ctx.value.fillStyle = '#0f1e2f'
  ctx.value.fillRect(0, 0, 360, 120)
  ctx.value.beginPath()
  ctx.value.strokeStyle = '#7ff5b8'
  ctx.value.lineWidth = 2.8
  ctx.value.shadowColor = '#8affc0'
  ctx.value.shadowBlur = 10

  const sliceWidth = 360 / dataArray.length
  let x = 0
  for (let i = 0; i < dataArray.length; i++) {
    const v = dataArray[i] / 128.0
    const y = (v * 120) / 2
    if (i === 0) ctx.value.moveTo(x, y)
    else ctx.value.lineTo(x, y)
    x += sliceWidth
  }
  ctx.value.stroke()
  ctx.value.shadowBlur = 0
  animationFrame = requestAnimationFrame(drawWave)
}

const updateTimer = () => {
  if (!recordingStartTime) return
  const elapsed = Math.floor((Date.now() - recordingStartTime) / 1000)
  const mins = Math.floor(elapsed / 60)
  const secs = elapsed % 60
  recordingTimeDisplay.value = `${mins}:${secs < 10 ? '0' : ''}${secs}`
}

const toggleRecording = async () => {
  if (!isRecording.value) {
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
      document.querySelectorAll('.play-btn').forEach(b => b.innerText = '▶')
    }

    try {
      audioChunks = []
      mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
      
      const audioContext = new (window.AudioContext || window.webkitAudioContext)()
      const source = audioContext.createMediaStreamSource(mediaStream)
      analyser = audioContext.createAnalyser()
      analyser.fftSize = 256
      dataArray = new Uint8Array(analyser.frequencyBinCount)
      source.connect(analyser)

      mediaRecorder = new MediaRecorder(mediaStream)
      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.push(e.data)
      }
      mediaRecorder.onstop = () => {
        appendLog(`⏸️ 录音结束，大小: ${audioChunks.length} chunks`)
        showUploadConfig.value = true
        recordingName.value = `录音 ${new Date().toLocaleString()}`
        
        mediaStream.getTracks().forEach(t => t.stop())
        mediaStream = null
        if (animationFrame) cancelAnimationFrame(animationFrame)
        drawSilent()
      }

      mediaRecorder.start()
      isRecording.value = true
      recordingStartTime = Date.now()
      timerInterval = setInterval(updateTimer, 1000)
      
      appendLog('🎤 开始录音...')
      drawWave()

    } catch (err) {
      console.error(err)
      appendLog('❌ 无法获取麦克风权限')
    }
  } else {
    if (mediaRecorder && mediaRecorder.state !== 'inactive') {
      mediaRecorder.stop()
    }
    isRecording.value = false
    clearInterval(timerInterval)
  }
}

const uploadRecording = async () => {
  if (audioChunks.length === 0) {
    appendLog('⚠️ 没有录音数据')
    return
  }
  
  const blob = new Blob(audioChunks, { type: 'audio/webm' })
  const formData = new FormData()
  formData.append('audio', blob, `rec_${Date.now()}.webm`)
  formData.append('name', recordingName.value.trim() || `录音 ${new Date().toLocaleString()}`)

  appendLog('⏳ 正在上传...')

  try {
    const res = await fetch(backendUrl.value, {
      method: 'POST',
      credentials: 'include',
      body: formData
    })
    const data = await res.json()
    appendLog('✅ 上传成功! ID: ' + (data.id || 'Unknown'))
    showUploadConfig.value = false
    audioChunks = []
    recordingName.value = ''
  } catch (e) {
    console.error(e)
    appendLog('❌ 上传失败: ' + e.message)
  }
}

const playAudio = (url, btn) => {
  if (currentAudio) {
    currentAudio.pause()
    currentAudio = null
    document.querySelectorAll('.play-btn').forEach(b => b.innerText = '▶')
  }

  const audio = new Audio(url)
  audio.play()
  currentAudio = audio
  btn.innerText = '⏸'

  audio.onended = () => {
    btn.innerText = '▶'
    currentAudio = null
  }
  
  audio.onerror = () => {
    alert('无法播放音频')
    btn.innerText = '▶'
    currentAudio = null
  }
}

const editingId = ref(null)
const newName = ref('')
const startEdit = (item) => {
  editingId.value = item.id
  newName.value = item.name || `Recording #${item.id}`
}

const saveName = async (item) => {
  if (!newName.value.trim()) {
    alert('名称不能为空')
    return
  }

  try {
    await apiFetch(`/recordings/${item.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.value })
    })
    item.name = newName.value
    editingId.value = null
  } catch (e) {
    console.error(e)
    alert('更新失败: ' + e.message)
  }
}

const transcribeItem = async (item) => {
  if (!item?.id || isTranscribing(item.id)) {
    return
  }

  markPending(transcribingIds, item.id)
  try {
    const res = await apiFetch(`/recordings/${item.id}/transcribe`, {
      method: 'POST'
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || '转写失败')
    }
    appendLog(`✅ ${item.name || `录音 ${item.id}`} 转写完成`)
    await loadRecordings()
  } catch (e) {
    console.error(e)
    alert('转写失败: ' + e.message)
  } finally {
    clearPending(transcribingIds, item.id)
  }
}

const deleteRecording = async (item) => {
  if (!item?.id || isDeleting(item.id)) {
    return
  }

  const confirmed = window.confirm(`确定删除“${item.name || `录音 ${item.id}`}”吗？删除后无法恢复。`)
  if (!confirmed) {
    return
  }

  markPending(deletingIds, item.id)
  try {
    const res = await apiFetch(`/recordings/${item.id}`, {
      method: 'DELETE'
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.error || data.message || '删除失败')
    }
    recordings.value = recordings.value.filter(record => record.id !== item.id)
    appendLog(`🗑️ 已删除 ${item.name || `录音 ${item.id}`}`)
  } catch (e) {
    console.error(e)
    alert('删除失败: ' + e.message)
  } finally {
    clearPending(deletingIds, item.id)
  }
}

const getDisplayName = () => currentUser.value?.nickname || currentUser.value?.username || '未登录用户'

const getAvatarText = () => getAvatarLabelByValue(currentUser.value?.avatar) || getDisplayName().slice(0, 1)

const getRoleLabel = () => currentUser.value?.role || '未设置'

const getPhoneLabel = () => currentUser.value?.phone || '未绑定'

const openProfileDialog = (mode) => {
  profileDialogMode.value = mode
  profileDialogValue.value = ''
  profileDialogValue2.value = ''

  if (mode === 'role') {
    profileDialogTitle.value = '设置角色'
    profileDialogValue.value = currentUser.value?.role || '普通用户'
  } else if (mode === 'nickname') {
    profileDialogTitle.value = '修改名字'
    profileDialogValue.value = currentUser.value?.nickname || ''
  } else if (mode === 'avatar') {
    profileDialogTitle.value = '修改头像'
    profileDialogValue.value = currentUser.value?.avatar || avatarOptions[0].value
  } else if (mode === 'phone') {
    profileDialogTitle.value = '更换手机号'
    profileDialogValue.value = currentUser.value?.phone || ''
  } else if (mode === 'password') {
    profileDialogTitle.value = '修改密码'
  }

  profileDialogVisible.value = true
}

const closeProfileDialog = () => {
  profileDialogVisible.value = false
}

const submitProfileDialog = async () => {
  if (!currentUser.value?.id) {
    alert('请先登录')
    return
  }

  const payload = {}
  if (profileDialogMode.value === 'role') {
    payload.role = profileDialogValue.value
  }
  if (profileDialogMode.value === 'nickname') {
    if (!profileDialogValue.value.trim()) {
      alert('请输入名字')
      return
    }
    payload.nickname = profileDialogValue.value.trim()
  }
  if (profileDialogMode.value === 'avatar') {
    if (!profileDialogValue.value) {
      alert('请选择头像')
      return
    }
    payload.avatar = profileDialogValue.value
  }
  if (profileDialogMode.value === 'phone') {
    if (!profileDialogValue.value.trim()) {
      alert('请输入手机号')
      return
    }
    payload.phone = profileDialogValue.value.trim()
  }
  if (profileDialogMode.value === 'password') {
    if (!profileDialogValue.value || !profileDialogValue2.value) {
      alert('请填写完整密码')
      return
    }
    if (profileDialogValue.value !== profileDialogValue2.value) {
      alert('两次输入的密码不一致')
      return
    }
    payload.password = profileDialogValue.value
  }

  try {
    const res = await apiFetch('/api/user/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || '保存失败')
    }
    currentUser.value = normalizeUser(data.user)
    closeProfileDialog()
    appendLog(`✅ ${profileDialogTitle.value}成功`)
  } catch (e) {
    alert(`${profileDialogTitle.value}失败: ${e.message}`)
  }
}

const unbindPhone = async () => {
  if (!currentUser.value?.phone) {
    return
  }
  try {
    const res = await apiFetch('/api/user/update', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: '' })
    })
    const data = await res.json()
    if (!res.ok || !data.success) {
      throw new Error(data.message || '解绑失败')
    }
    currentUser.value = normalizeUser(data.user)
    appendLog('✅ 手机号已解绑')
  } catch (e) {
    alert('解绑失败: ' + e.message)
  }
}

const logout = async () => {
  try {
    await apiFetch('/api/user/logout', { method: 'POST' })
  } catch (e) {
    console.error(e)
  }
  currentUser.value = null
  username.value = ''
  password.value = ''
  currentView.value = 'login'
}

onMounted(() => {
  nextTick(() => {
    if (canvasRef.value) {
      ctx.value = canvasRef.value.getContext('2d')
      drawSilent()
    }
  })
  loadCurrentUser(true).then((loggedIn) => {
    if (loggedIn) {
      currentView.value = 'records'
    }
  })
})
</script>

<template>
  <div class="app">
    <div v-if="currentView === 'login'" class="view login-view" :style="{ transform: loginAnimating ? 'translateY(-100%)' : 'translateY(0)' }">
      <div class="login-card">
        <div class="login-title">欢迎登录</div>
        <div class="input-group">
          <label>账号</label>
          <input v-model="username" type="text" placeholder="admin" id="username">
        </div>
        <div class="input-group">
          <label>密码</label>
          <input v-model="password" type="password" placeholder="123456" id="password">
        </div>
        <button class="login-btn" @click="login">登录</button>
      </div>
    </div>

    <div v-else class="view main-view">
      <div class="main-content">
        <div v-if="currentView === 'recorder'" class="card recorder-card">
          <div class="recorder-header">
            <div class="recorder-title-row">
              <span class="recorder-title-icon">📱</span>
              <h1 class="recorder-title">录音助手</h1>
            </div>
            <div class="recorder-subtitle">点击下方按钮开始录音，结束后可直接命名并上传</div>
          </div>
          
          <div class="visualizer-container">
            <canvas ref="canvasRef" id="waveCanvas" width="360" height="120"></canvas>
            <div class="status-bar">
              <div class="flex-row" style="display:flex; align-items:center;">
                <span class="led" :class="{ active: isRecording }"></span>
                <span id="micStatusText">{{ isRecording ? '正在录音...' : '等待操作' }}</span>
              </div>
              <div>
                <span>{{ recordingTimeDisplay }}</span>
              </div>
            </div>
          </div>

          <div class="main-mic-container">
            <button 
              class="main-mic-btn" 
              :class="{ recording: isRecording }"
              @click="toggleRecording"
            >
              {{ isRecording ? '⏹️' : '🎤' }}
            </button>
          </div>

          <div class="recorder-actions">
            <div id="uploadConfig" :style="{ display: showUploadConfig ? 'block' : 'none', marginBottom: '12px' }">
              <input type="text" v-model="recordingName" placeholder="录音名称" class="url-input recorder-name-input">
            </div>
            <button id="sendBtn" class="login-btn recorder-upload-btn" :style="{ display: showUploadConfig ? 'inline-block' : 'none' }" @click="uploadRecording">
              💾 上传录音
            </button>
          </div>

          <div class="log-box" id="logBox">
            {{ logMessage }}
          </div>

        </div>

        <div v-else-if="currentView === 'records'" class="records-list">
          <h2 style="margin: 0 0 16px 8px; font-size: 1.4rem; color: #1d2b3a;">🗂️ 录音记录</h2>
          <div id="recordsContainer">
            <div v-if="recordings.length === 0" style="text-align:center; color:#8fa0b0; padding: 40px;">暂无记录</div>
            <div v-for="item in recordings" :key="item.id" class="record-item">
              <div class="record-info">
                <div class="record-title">
                  <template v-if="editingId !== item.id">
                    {{ item.name || `Recording #${item.id}` }}
                    <span style="font-size:0.8rem; color:#8fa0b0; cursor:pointer; margin-left:8px;" @click="startEdit(item)">✎</span>
                  </template>
                  <template v-else>
                    <div style="display:flex; align-items:center;">
                      <input v-model="newName" type="text" id="edit-input" style="width:140px; padding:4px; border:1px solid #ddd; border-radius:4px; font-size:0.9rem;">
                      <button @click="saveName(item); event.stopPropagation()" style="padding:4px 8px; font-size:0.8rem; margin-left:4px; background:#2e7d8f; color:white; border:none; border-radius:4px; cursor:pointer;">保存</button>
                      <button @click="editingId = null; event.stopPropagation()" style="padding:4px 8px; font-size:0.8rem; margin-left:2px; background:#eef4f8; color:#5a6b7c; border:none; border-radius:4px; cursor:pointer;">取消</button>
                    </div>
                  </template>
                </div>
                <div class="record-meta">{{ new Date(item.created_at).toLocaleString() }} · {{ (item.size / 1024).toFixed(1) }} KB</div>
                <div v-if="item.content && item.content.trim() !== ''" style="margin-top:8px; padding:8px; background:#f0f7ff; border-radius:6px; font-size:0.9rem; color:#2e7d8f;">
                  📝 {{ item.content }}
                </div>
                <div class="record-actions">
                  <button
                    class="record-action-btn record-action-primary"
                    :disabled="isTranscribing(item.id) || isDeleting(item.id)"
                    @click="transcribeItem(item)"
                  >
                    {{ isTranscribing(item.id) ? '翻译中...' : (item.content && item.content.trim() !== '' ? '重新翻译' : '转文字') }}
                  </button>
                  <button
                    class="record-action-btn record-action-danger"
                    :disabled="isDeleting(item.id) || isTranscribing(item.id)"
                    @click="deleteRecording(item)"
                  >
                    {{ isDeleting(item.id) ? '删除中...' : '删除录音' }}
                  </button>
                </div>
              </div>
              <button class="play-btn" @click="playAudio(`${getBaseUrl()}/recordings/${item.id}/media`, $event.target)">▶</button>
            </div>
          </div>
        </div>

        <div v-else-if="currentView === 'mine'" class="mine-page">
          <div class="profile-card">
            <button class="profile-avatar profile-avatar-btn" @click="openProfileDialog('avatar')">
              {{ getAvatarText() }}
            </button>
            <div class="profile-main">
              <div class="profile-name">{{ getDisplayName() }}</div>
              <div class="profile-links">
                <button class="link-action" @click="openProfileDialog('nickname')">修改名字</button>
                <button class="link-action" @click="openProfileDialog('avatar')">修改头像</button>
              </div>
            </div>
          </div>

          <div class="profile-tabs">
            <button class="profile-tab active">账户信息</button>
          </div>

          <div v-if="activeProfileTab === 'account'" class="account-panel">
            <div class="account-panel-title">账号设置</div>

            <div class="account-row">
              <div class="account-label">账号</div>
              <div class="account-value">{{ currentUser?.username || '未登录' }}</div>
              <div class="account-actions"></div>
            </div>

            <div class="account-row">
              <div class="account-label">所属角色</div>
              <div class="account-value">{{ getRoleLabel() }}</div>
              <div class="account-actions">
                <button class="link-action" @click="openProfileDialog('role')">去设置</button>
              </div>
            </div>

            <div class="account-row">
              <div class="account-label">手机号</div>
              <div class="account-value">{{ getPhoneLabel() }}</div>
              <div class="account-actions">
                <button class="link-action" @click="openProfileDialog('phone')">更换手机号</button>
                <button v-if="currentUser?.phone" class="link-action" @click="unbindPhone">解绑</button>
              </div>
            </div>

            <div class="account-row">
              <div class="account-label">密码</div>
              <div class="account-value">******</div>
              <div class="account-actions">
                <button class="link-action" @click="openProfileDialog('password')">修改密码</button>
              </div>
            </div>
          </div>

          <button class="logout-btn" @click="logout">退出登录</button>
        </div>
      </div>

      <div class="footer-nav">
        <div class="nav-item" :class="{ active: currentView === 'records' }" @click="showRecords">
          <div class="nav-icon">📂</div>
          <div>记录</div>
        </div>
        <div class="nav-item" :class="{ active: currentView === 'recorder' }" @click="showRecorder">
          <div class="nav-icon">🎤</div>
          <div>录音</div>
        </div>
        <div class="nav-item" :class="{ active: currentView === 'mine' }" @click="showMine">
          <div class="nav-icon">👤</div>
          <div>我的</div>
        </div>
      </div>
    </div>

    <div v-if="profileDialogVisible" class="dialog-mask" @click.self="closeProfileDialog">
      <div class="dialog-card">
        <div class="dialog-title">{{ profileDialogTitle }}</div>

        <select v-if="profileDialogMode === 'role'" v-model="profileDialogValue" class="dialog-input">
          <option v-for="role in roleOptions" :key="role" :value="role">{{ role }}</option>
        </select>

        <template v-else-if="profileDialogMode === 'avatar'">
          <div class="avatar-picker">
            <button
              v-for="avatar in avatarOptions"
              :key="avatar.value"
              class="avatar-option"
              :class="{ active: profileDialogValue === avatar.value }"
              @click="profileDialogValue = avatar.value"
            >
              {{ avatar.label }}
            </button>
          </div>
        </template>

        <template v-else-if="profileDialogMode === 'nickname'">
          <input v-model="profileDialogValue" type="text" class="dialog-input" placeholder="请输入新的名字">
        </template>

        <template v-else-if="profileDialogMode === 'phone'">
          <input v-model="profileDialogValue" type="text" class="dialog-input" placeholder="请输入新的手机号">
        </template>

        <template v-else-if="profileDialogMode === 'password'">
          <input v-model="profileDialogValue" type="password" class="dialog-input" placeholder="请输入新密码">
          <input v-model="profileDialogValue2" type="password" class="dialog-input" placeholder="请再次输入新密码">
        </template>

        <div class="dialog-actions">
          <button class="dialog-btn dialog-btn-secondary" @click="closeProfileDialog">取消</button>
          <button class="dialog-btn dialog-btn-primary" @click="submitProfileDialog">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
* {
  box-sizing: border-box;
  font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
  -webkit-tap-highlight-color: transparent;
}
body {
  background: #f5f7fa;
  margin: 0;
  height: 100vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.app {
  width: 100%;
  height: 100%;
}

.view {
  width: 100%;
  height: 100%;
  display: flex;
  flex-direction: column;
  position: absolute;
  top: 0;
  left: 0;
  background: #f5f7fa;
  transition: transform 0.3s ease;
}

.login-view {
  z-index: 100;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: linear-gradient(135deg, #eef2f8 0%, #dbe4f0 100%);
}
.login-card {
  background: white;
  padding: 32px 24px;
  border-radius: 24px;
  box-shadow: 0 10px 30px rgba(0,0,0,0.08);
  width: 100%;
  max-width: 360px;
  text-align: center;
}
.login-title {
  font-size: 1.5rem;
  font-weight: 600;
  color: #1a2b3c;
  margin-bottom: 24px;
}
.input-group {
  margin-bottom: 16px;
  text-align: left;
}
.input-group label {
  display: block;
  font-size: 0.9rem;
  color: #5a6b7c;
  margin-bottom: 6px;
}
.input-group input {
  width: 100%;
  padding: 12px 16px;
  border: 1px solid #dce4ec;
  border-radius: 12px;
  font-size: 1rem;
  outline: none;
  transition: border-color 0.2s;
}
.input-group input:focus {
  border-color: #2e7d8f;
}
.login-btn {
  width: 100%;
  padding: 14px;
  background: #2e7d8f;
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  margin-top: 12px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(46,125,143,0.3);
}
.login-btn:active {
  transform: scale(0.98);
}

.main-view {
  display: flex;
  flex-direction: column;
}
.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
  padding-bottom: 90px;
}

.records-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.record-item {
  background: white;
  border-radius: 16px;
  padding: 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}
.record-info {
  flex: 1;
}
.record-title {
  font-size: 0.95rem;
  font-weight: 600;
  color: #1d2b3a;
  margin-bottom: 4px;
}
.record-meta {
  font-size: 0.75rem;
  color: #8daec4;
}
.record-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  margin-top: 10px;
}
.record-action-btn {
  padding: 6px 12px;
  font-size: 0.8rem;
  border: none;
  border-radius: 999px;
  cursor: pointer;
}
.record-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.record-action-primary {
  background: #2e7d8f;
  color: #fff;
}
.record-action-danger {
  background: #fff1f1;
  color: #d14c4c;
}
.play-btn {
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: #eef4f8;
  color: #2e7d8f;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  cursor: pointer;
  font-size: 1.2rem;
  transition: 0.2s;
}
.play-btn:active {
  background: #dce4ec;
  transform: scale(0.95);
}

.card {
  background: white;
  border-radius: 24px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.05);
  padding: 24px 20px;
  margin-bottom: 20px;
}
.recorder-card {
  padding: 24px 18px 22px;
}
h1 {
  font-size: 1.5rem;
  margin: 0 0 12px 0;
  color: #1d2b3a;
  display: flex;
  align-items: center;
  gap: 8px;
}
.recorder-header {
  margin-bottom: 18px;
}
.recorder-title-row {
  display: flex;
  align-items: center;
  gap: 12px;
}
.recorder-title-icon {
  width: 42px;
  height: 42px;
  border-radius: 14px;
  background: #eef4f8;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  flex-shrink: 0;
}
.recorder-title {
  margin: 0;
  font-size: 1.95rem;
  font-weight: 800;
  letter-spacing: 0.5px;
}
.recorder-subtitle {
  margin-top: 10px;
  color: #7a8a9a;
  font-size: 0.92rem;
  line-height: 1.5;
}
.visualizer-container {
  background: #0b1725;
  border-radius: 24px;
  padding: 18px;
  margin-bottom: 24px;
  box-shadow: 0 12px 26px rgba(0,0,0,0.16);
}
canvas {
  width: 100%;
  height: 132px;
  background: #0f1e2f;
  border-radius: 16px;
}
.status-bar {
  display: flex;
  justify-content: space-between;
  color: #8daec4;
  font-size: 0.82rem;
  margin-top: 14px;
}
.led {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #3a4b5c;
  display: inline-block;
  margin-right: 6px;
}
.led.active {
  background: #5eff7c;
  box-shadow: 0 0 8px #5eff7c;
}

.footer-nav {
  position: fixed;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 70px;
  background: white;
  box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
  display: flex;
  justify-content: space-around;
  align-items: center;
  padding: 0 16px;
  z-index: 50;
  border-top-left-radius: 24px;
  border-top-right-radius: 24px;
}
.nav-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #8fa0b0;
  font-size: 0.75rem;
  cursor: pointer;
  width: 60px;
}
.nav-item.active {
  color: #2e7d8f;
}
.nav-icon {
  font-size: 1.4rem;
  margin-bottom: 4px;
}

.main-mic-container {
  display: flex;
  justify-content: center;
  margin: 24px 0 28px;
}
.main-mic-btn {
  width: 92px;
  height: 92px;
  border-radius: 50%;
  background: #2e7d8f;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-size: 2.2rem;
  box-shadow: 0 14px 28px rgba(46,125,143,0.32);
  transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
  cursor: pointer;
  border: none;
  outline: none;
}
.main-mic-btn.recording {
  background: #ff5a4f;
  box-shadow: 0 0 0 6px rgba(255,90,79,0.2);
  transform: scale(1.1);
  animation: pulse 1.5s infinite;
}
.main-mic-btn:active {
  transform: scale(0.95);
}

@keyframes pulse {
  0% { box-shadow: 0 0 0 0 rgba(255,90,79,0.4); }
  70% { box-shadow: 0 0 0 10px rgba(255,90,79,0); }
  100% { box-shadow: 0 0 0 0 rgba(255,90,79,0); }
}

.log-box {
  background: #edf2f9;
  padding: 14px 16px;
  border-radius: 16px;
  font-size: 0.85rem;
  color: #3a4b5c;
  margin-top: 12px;
  max-height: 100px;
  overflow-y: auto;
}
.recorder-actions {
  text-align: center;
  margin-bottom: 12px;
}
.recorder-name-input {
  width: 100%;
  max-width: 320px;
  text-align: center;
  margin: 0 auto;
}
.recorder-upload-btn {
  width: 100%;
  max-width: 320px;
  background: #1f6c7c;
}
.url-config {
  background: #eef4f8;
  padding: 16px;
  border-radius: 16px;
  margin-top: 20px;
}
.url-input {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #dce4ec;
  border-radius: 8px;
  margin-top: 8px;
}

.mine-page {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.profile-card {
  background: #f2f4f7;
  border-radius: 20px;
  padding: 22px 20px;
  display: flex;
  align-items: center;
  gap: 16px;
}

.profile-avatar {
  width: 78px;
  height: 78px;
  border-radius: 50%;
  background: linear-gradient(135deg, #f5dba6 0%, #f0c66d 100%);
  color: #5a3e12;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  flex-shrink: 0;
}

.profile-avatar-btn {
  border: none;
  cursor: pointer;
}

.profile-main {
  min-width: 0;
}

.profile-name {
  font-size: 1.6rem;
  font-weight: 700;
  color: #142033;
}

.profile-links {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}

.profile-tabs {
  display: flex;
  gap: 20px;
  padding: 0 2px;
}

.profile-tab {
  padding: 0 0 10px;
  border: none;
  border-bottom: 3px solid transparent;
  background: transparent;
  color: #2d3a4d;
  font-size: 1.05rem;
  font-weight: 600;
  cursor: pointer;
}

.profile-tab.active {
  color: #3b6ff8;
  border-bottom-color: #3b6ff8;
}

.account-panel {
  background: #f7f8fa;
  border-radius: 18px;
  padding: 20px;
}

.account-panel-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #1d2b3a;
  margin-bottom: 14px;
}

.account-row {
  display: grid;
  grid-template-columns: 92px 1fr auto;
  align-items: center;
  gap: 12px;
  background: #fff;
  padding: 18px 16px;
  border-bottom: 1px solid #edf1f5;
}

.account-row:first-of-type {
  border-top-left-radius: 12px;
  border-top-right-radius: 12px;
}

.account-row:last-of-type {
  border-bottom: none;
  border-bottom-left-radius: 12px;
  border-bottom-right-radius: 12px;
}

.account-label {
  color: #1b2433;
  font-weight: 600;
}

.account-value {
  color: #566273;
  word-break: break-all;
}

.account-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.link-action {
  border: none;
  background: transparent;
  color: #3b6ff8;
  font-size: 0.95rem;
  cursor: pointer;
  padding: 0;
}

.logout-btn {
  width: 100%;
  padding: 14px;
  border: none;
  border-radius: 14px;
  background: #eef2f6;
  color: #5a6b7c;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.dialog-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.36);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  z-index: 120;
}

.dialog-card {
  width: 100%;
  max-width: 360px;
  background: #fff;
  border-radius: 20px;
  padding: 22px 18px 18px;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.18);
}

.dialog-title {
  font-size: 1.1rem;
  font-weight: 700;
  color: #152033;
  margin-bottom: 14px;
}

.dialog-input {
  width: 100%;
  padding: 12px 14px;
  border: 1px solid #d8e0e8;
  border-radius: 12px;
  font-size: 0.95rem;
  margin-bottom: 12px;
}

.avatar-picker {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 10px;
  margin-bottom: 12px;
}

.avatar-option {
  height: 58px;
  border: 1px solid #d8e0e8;
  border-radius: 14px;
  background: #f8fafc;
  font-size: 1.6rem;
  cursor: pointer;
}

.avatar-option.active {
  border-color: #2e7d8f;
  background: #e9f6f8;
}

.dialog-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.dialog-btn {
  min-width: 88px;
  padding: 10px 16px;
  border-radius: 12px;
  border: none;
  cursor: pointer;
  font-weight: 600;
}

.dialog-btn-secondary {
  background: #eef2f6;
  color: #5a6b7c;
}

.dialog-btn-primary {
  background: #2e7d8f;
  color: #fff;
}
</style>
