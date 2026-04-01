// pages/index/index.js
Page({
  data: {
    bannerOk: false
  },

  onShow() {
    const token = wx.getStorageSync("token");
    if (!token) {
      wx.redirectTo({ url: "/pages/login/login" });
    }
  },

  onBannerErr() {
    this.setData({ bannerOk: false });
  },

  goMap() {
    wx.navigateTo({ url: "/pages/map/map" });
  },

  goAi() {
    wx.navigateTo({ url: "/pages/ai/ai" });
  },

  goScenic() {
    wx.navigateTo({ url: "/pages/scenic/scenic" });
  },

  goFacility() {
    wx.navigateTo({ url: "/pages/map/facility" });
  },

  goMine() {
    wx.navigateTo({ url: "/pages/mine/mine" });
  }
});
