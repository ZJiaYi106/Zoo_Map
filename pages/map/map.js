// pages/map/map.js — 地图标记、定位、弹窗

/** 园内主要景点与设施（示例坐标，可按实际测绘调整） */
const MARKER_SEED = [
  { id: 1, title: "猛兽区观景台", intro: "可俯瞰猛兽活动区，建议保持安静，勿投喂。", latitude: 39.9402, longitude: 119.5965, type: "scenic" },
  { id: 2, title: "食草动物区", intro: "长颈鹿、斑马等食草动物散养区域，适合亲子观赏。", latitude: 39.9395, longitude: 119.5988, type: "scenic" },
  { id: 3, title: "鸟类表演场", intro: "鸟类互动与科普讲解场次以当日公告为准。", latitude: 39.9378, longitude: 119.5995, type: "scenic" },
  { id: 4, title: "园区东门厕所", intro: "无障碍卫生间位于入口左侧。", latitude: 39.9382, longitude: 119.5968, type: "toilet" },
  { id: 5, title: "中央超市", intro: "饮用水、简餐与纪念品。", latitude: 39.939, longitude: 119.5975, type: "shop" },
  { id: 6, title: "狮虎园观景台", intro: "拍摄猛兽区经典机位，注意安全线。", latitude: 39.9405, longitude: 119.5972, type: "view" }
];

Page({
  data: {
    longitude: 119.5977,
    latitude: 39.9388,
    scale: 16,
    markers: [],
    showDetail: false,
    currentMarker: { title: "", intro: "" }
  },

  onLoad(options) {
    this._buildMarkers();
    if (options.from === "facility") {
      try {
        const f = wx.getStorageSync("mapFocus");
        if (f && f.latitude && f.longitude) {
          this.setData({
            longitude: f.longitude,
            latitude: f.latitude,
            scale: 17,
            showDetail: true,
            currentMarker: { title: f.title || "设施", intro: f.intro || "" }
          });
        }
        wx.removeStorageSync("mapFocus");
      } catch (e) {
        console.warn(e);
      }
    }
  },

  _buildMarkers() {
    const markers = MARKER_SEED.map((item) => ({
      id: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      title: item.title,
      width: 32,
      height: 32,
      callout: {
        content: item.title,
        color: "#333",
        fontSize: 12,
        borderRadius: 8,
        bgColor: "#fff",
        padding: 8,
        display: "BYCLICK"
      }
    }));
    this.setData({ markers });
  },

  onMarkerTap(e) {
    const mid = e.detail.markerId;
    const raw = MARKER_SEED.find((x) => x.id === mid);
    if (!raw) return;
    this.setData({
      showDetail: true,
      currentMarker: { title: raw.title, intro: raw.intro }
    });
  },

  closePopup() {
    this.setData({ showDetail: false });
  },

  locateMe() {
    wx.getLocation({
      type: "gcj02",
      success: (res) => {
        this.setData({
          longitude: res.longitude,
          latitude: res.latitude,
          scale: 17
        });
      },
      fail: () => {
        wx.showModal({
          title: "需要位置权限",
          content: "请在设置中允许小程序使用位置信息，以便为您定位。",
          showCancel: false
        });
      }
    });
  },

  goAiRoute() {
    wx.navigateTo({
      url: "/pages/ai/ai?preset=route"
    });
  },

  goFacility() {
    wx.navigateTo({ url: "/pages/map/facility" });
  }
});
