// pages/map/facility.js — 设施分类与跳转地图定位
const { request } = require("../../utils/request.js");

Page({
  data: {
    type: "厕所",
    list: []
  },

  onLoad() {
    this.fetchList("厕所");
  },

  onCat(e) {
    const t = e.currentTarget.dataset.type;
    this.setData({ type: t });
    this.fetchList(t);
  },

  fetchList(type) {
    wx.showLoading({ title: "加载中" });
    request("/api/facility/list?type=" + encodeURIComponent(type) + "&page=1&page_size=50")
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        this.setData({ list: data.items || [] });
      })
      .catch(() => wx.hideLoading());
  },

  goMapNav(e) {
    const d = e.currentTarget.dataset;
    const lat = parseFloat(d.lat);
    const lng = parseFloat(d.lng);
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      try {
        wx.setStorageSync("mapFocus", {
          latitude: lat,
          longitude: lng,
          title: d.name || "设施",
          intro: d.intro || ""
        });
      } catch (err) {
        console.warn(err);
      }
    }
    wx.navigateTo({ url: "/pages/map/map?from=facility" });
  }
});
