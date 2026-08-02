export default defineAppConfig({
  pages: [
    'pages/login/index',
    'pages/records/index',
    'pages/recorder/index',
    'pages/mine/index',
    'pages/notifications/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    backgroundColor: '#f5f7fa',
    navigationBarBackgroundColor: '#f5f7fa',
    navigationBarTitleText: '录音助手',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#8fa0b0',
    selectedColor: '#2e7d8f',
    backgroundColor: '#ffffff',
    borderStyle: 'white',
    list: [
      {
        pagePath: 'pages/records/index',
        text: '记录',
        iconPath: 'assets/tabbar/records.png',
        selectedIconPath: 'assets/tabbar/records-selected.png'
      },
      {
        pagePath: 'pages/recorder/index',
        text: '录音',
        iconPath: 'assets/tabbar/recorder.png',
        selectedIconPath: 'assets/tabbar/recorder-selected.png'
      },
      {
        pagePath: 'pages/mine/index',
        text: '我的',
        iconPath: 'assets/tabbar/mine.png',
        selectedIconPath: 'assets/tabbar/mine-selected.png'
      }
    ]
  }
})
