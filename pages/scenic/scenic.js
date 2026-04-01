// pages/scenic/scenic.js — 景点列表、筛选、AI 讲解、收藏
const { request } = require("../../utils/request.js");

const PLACEHOLDER_IMG =
  "https://dummyimage.com/750x400/1E88E5/ffffff.png&text=QHD+Zoo";

Page({
  data: {
    activeCat: "",
    list: [],
    favoritesOnly: false,
    explainShow: false,
    explainTitle: "",
    explainText: ""
  },

  onLoad(options) {
    if (options.favorites === "1" || options.mode === "favorites") {
      this.setData({ favoritesOnly: true });
      this.loadFavorites();
    } else {
      this.loadList();
    }
  },

  onShow() {
    if (!this.data.favoritesOnly) {
      this.loadList();
    }
  },

  loadList() {
    const cat = this.data.activeCat;
    wx.showLoading({ title: "加载中" });
    const q = cat ? "?category=" + encodeURIComponent(cat) + "&page=1&page_size=50" : "?page=1&page_size=50";
    request("/api/scenic/list" + q)
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        const rows = (data.items || data.list || []).map((x) => ({
          ...x,
          image: x.image || PLACEHOLDER_IMG,
          collected: !!x.collected
        }));
        this.setData({ list: rows });
      })
      .catch(() => wx.hideLoading());
  },

  loadFavorites() {
    wx.showLoading({ title: "加载中" });
    request("/api/collection/list?page=1&page_size=50")
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        const rows = (data.items || []).map((x) => ({
          ...x,
          image: x.image || PLACEHOLDER_IMG,
          collected: true
        }));
        this.setData({ list: rows });
      })
      .catch(() => wx.hideLoading());
  },

  onTab(e) {
    const cat = e.currentTarget.dataset.cat;
    this.setData({ activeCat: cat });
    this.loadList();
  },

  onImgErr(e) {
    const id = e.currentTarget.dataset.id;
    const list = this.data.list.map((item) =>
      item.id === id ? { ...item, image: PLACEHOLDER_IMG } : item
    );
    this.setData({ list });
  },

  aiExplain(e) {
    const name = e.currentTarget.dataset.name;
    wx.showLoading({ title: "生成讲解" });
    request("/api/ai/scenic-explain", {
      method: "POST",
      data: { scenic_name: name }
    })
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        const text = data.content || data.reply || "";
        this.setData({
          explainShow: true,
          explainTitle: name,
          explainText: text
        });
      })
      .catch(() => wx.hideLoading());
  },

  closeExplain() {
    this.setData({ explainShow: false });
  },

  toggleFav(e) {
    const id = e.currentTarget.dataset.id;
    const item = this.data.list.find((x) => x.id === id);
    const collected = !item.collected;
    wx.showLoading({ title: "处理中" });
    request("/api/collection/toggle", {
      method: "POST",
      data: { scenic_id: id, collect: collected }
    })
      .then(() => {
        wx.hideLoading();
        const list = this.data.list.map((x) =>
          x.id === id ? { ...x, collected } : x
        );
        this.setData({ list });
        wx.showToast({ title: collected ? "已收藏" : "已取消", icon: "success" });
      })
      .catch(() => wx.hideLoading());
  }
});
