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
      placeholderText: '输入 "cloud" 可切回默认的云托管模式',
      content: this.data.serverUrl,
      editable: true,
      success: (res) => {
        if (res.confirm) {
          let newUrl = (res.content || '').trim();
          
          // 如果为空或输入为 cloud，自动切回默认免备案的云托管直连通道
          if (!newUrl || newUrl.toLowerCase() === 'cloud') {
            wx.removeStorageSync('serverUrl');
            app.globalData.serverUrl = 'http://localhost:5050';
            app.globalData.useCloud = true;
            this.setData({ serverUrl: 'http://localhost:5050' });
            
            wx.showToast({
              title: '已切回云托管模式',
              icon: 'success'
            });
            return;
          }

          // 补全 http 协议头
          if (!newUrl.startsWith('http://') && !newUrl.startsWith('https://')) {
            newUrl = 'http://' + newUrl;
          }
          
          wx.setStorageSync('serverUrl', newUrl);
          app.globalData.serverUrl = newUrl;
          app.globalData.useCloud = false; // 降级为局域网 IP 直连模式
          this.setData({ serverUrl: newUrl });
          
          wx.showToast({
            title: '已切换为局域网',
            icon: 'success'
          });
        }
      }
    });
  }
});
