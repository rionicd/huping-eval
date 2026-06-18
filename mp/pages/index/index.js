const app = getApp();

Page({
  data: {
    serverUrl: ''
  },

  onShow() {
    this.setData({
      serverUrl: app.globalData.serverUrl
    });
  },

  // 路由跳转至评测页面
  selectRole(e) {
    const role = e.currentTarget.dataset.role;
    wx.navigateTo({
      url: `/pages/eval/eval?role=${encodeURIComponent(role)}`
    });
  },

  // 长按配置 IP 彩蛋
  onConfigIP() {
    wx.showModal({
      title: '配置服务器 IP 地址',
      placeholderText: '请输入服务器局域网地址，例如 http://192.168.1.100:5050',
      content: this.data.serverUrl,
      editable: true,
      success: (res) => {
        if (res.confirm) {
          let newUrl = (res.content || '').trim();
          if (!newUrl) {
            wx.showToast({
              title: '地址不能为空',
              icon: 'none'
            });
            return;
          }
          // 补全 http 协议头
          if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = 'http://' + newUrl;
          }
          
          wx.setStorageSync('serverUrl', newUrl);
          app.globalData.serverUrl = newUrl;
          this.setData({ serverUrl: newUrl });
          
          wx.showToast({
            title: 'IP 配置成功',
            icon: 'success'
          });
        }
      }
    });
  }
});
