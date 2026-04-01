// pages/mine/mine.js
const app = getApp();

const DEF_AVATAR =
  "https://dummyimage.com/200x200/90caf9/ffffff.png&text=User";

Page({
  data: {
    user: {
      nickName: "游客",
      avatarUrl: DEF_AVATAR
    }
  },

  onShow() {
    if (!wx.getStorageSync("token")) {
      wx.redirectTo({ url: "/pages/login/login" });
      return;
    }
    const u = wx.getStorageSync("userInfo") || app.globalData.userInfo || {};
    this.setData({
      user: {
        nickName: u.nickname || u.nickName || "游客",
        avatarUrl: u.avatar || u.avatarUrl || DEF_AVATAR
      }
    });
  },

  onAvatarErr() {
    this.setData({ "user.avatarUrl": DEF_AVATAR });
  },

  goFav() {
    wx.navigateTo({ url: "/pages/scenic/scenic?favorites=1" });
  },

  goHistory() {
    wx.navigateTo({ url: "/pages/ai/ai?from=mine" });
  },

  goAbout() {
    wx.showModal({
      title: "关于我们",
      content:
        "秦皇岛野生动物园 AI 智能导览小程序\n\n本演示项目用于学习全栈与 AI 导览场景，数据仅供参考。",
      showCancel: false
    });
  },

  logout() {
    wx.showModal({
      title: "确认退出",
      content: "将清除本地登录状态",
      success: (res) => {
        if (res.confirm) {
          app.clearAuth();
          wx.reLaunch({ url: "/pages/login/login" });
        }
      }
    });
  }
});
