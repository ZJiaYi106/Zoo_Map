// pages/ai/ai.js — AI 对话、快捷需求、历史、语音播报
const { request } = require("../../utils/request.js");
const app = getApp();

const STORAGE_KEY = "ai_chat_history_local";

Page({
  data: {
    input: "",
    messages: [],
    scrollTo: "",
    lastAssistantText: "",
    lastAudioUrl: ""
  },

  audioCtx: null,

  onLoad(options) {
    this._loadHistory();
    if (options.preset === "route") {
      this.setData({
        input: "请结合园内景点分布，为我规划一条步行游览路线，并说明耗时与难度。"
      });
    }
    const hist = wx.getStorageSync(STORAGE_KEY) || [];
    if (options.from === "mine" && hist.length) {
      this.setData({ messages: this._normalizeMessages(hist) });
    }
  },

  onUnload() {
    if (this.audioCtx) {
      try {
        this.audioCtx.destroy();
      } catch (e) {}
    }
  },

  _normalizeMessages(arr) {
    return arr.map((m, i) => ({
      id: m.id || "h" + i,
      role: m.role,
      content: m.content
    }));
  },

  _loadHistory() {
    const local = wx.getStorageSync(STORAGE_KEY) || [];
    if (local.length) {
      const lastAi = [...local].reverse().find((x) => x.role === "assistant");
      this.setData({
        messages: this._normalizeMessages(local),
        lastAssistantText: lastAi ? lastAi.content : "",
        lastAudioUrl: lastAi ? lastAi.audio_url || "" : ""
      });
    }
  },

  onInput(e) {
    this.setData({ input: e.detail.value });
  },

  quickSend(e) {
    const text = e.currentTarget.dataset.text;
    let type = e.currentTarget.dataset.type || "route_planning";
    if (type === "route") type = "route_planning";
    this.setData({ input: text });
    this._sendWithType(text, type);
  },

  send() {
    const text = (this.data.input || "").trim();
    if (!text) {
      wx.showToast({ title: "请输入内容", icon: "none" });
      return;
    }
    this._inferAndSend(text);
  },

  /** 简单意图：优先走后端完整分类，此处先做关键词提示类型 */
  _inferAndSend(text) {
    let type = "qa";
    if (/路线|规划|游|老人|亲子|打卡|小时/.test(text)) {
      if (/打卡|拍|机位/.test(text)) type = "checkin";
      else if (/老人|轻松|亲子|科普|小时|快速/.test(text)) type = "route_planning";
      else type = "route_planning";
    }
    this._sendWithType(text, type);
  },

  _sendWithType(text, demandType) {
    const msgs = this.data.messages.concat([
      { id: "u" + Date.now(), role: "user", content: text }
    ]);
    this.setData({ messages: msgs, input: "", scrollTo: "msg-" + (msgs.length - 1) });
    wx.showLoading({ title: "思考中" });
    const payload = {
      content: text,
      demand_type: demandType,
      openid: (app.globalData.userInfo && app.globalData.userInfo.openid) || ""
    };
    request("/api/ai/chat", { method: "POST", data: payload })
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        const reply = data.reply || data.content || "暂无回复";
        const audioUrl = data.tts_url || "";
        const list = this.data.messages.concat([
          { id: "a" + Date.now(), role: "assistant", content: reply, audio_url: audioUrl }
        ]);
        this.setData({
          messages: list,
          lastAssistantText: reply,
          lastAudioUrl: audioUrl,
          scrollTo: "msg-" + (list.length - 1)
        });
        this._persistHistory(list);
      })
      .catch(() => {
        wx.hideLoading();
      });
  },

  _persistHistory(list) {
    const slim = list.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.content,
      audio_url: m.audio_url || ""
    }));
    wx.setStorageSync(STORAGE_KEY, slim);
  },

  playVoice() {
    const url = this.data.lastAudioUrl;
    const text = this.data.lastAssistantText;
    if (!text && !url) {
      wx.showToast({ title: "暂无AI回复可播报", icon: "none" });
      return;
    }
    if (url) {
      if (!this.audioCtx) this.audioCtx = wx.createInnerAudioContext();
      this.audioCtx.stop();
      this.audioCtx.src = url;
      this.audioCtx.play();
      this.audioCtx.onError(() => {
        wx.showToast({ title: "音频播放失败", icon: "none" });
      });
      return;
    }
    wx.showModal({
      title: "语音播报",
      content: "当前未返回 TTS 音频地址。您可复制文字或使用系统读屏功能朗读以下内容：\n\n" + text.slice(0, 500),
      confirmText: "复制全文",
      success: (r) => {
        if (r.confirm) {
          wx.setClipboardData({ data: text });
        }
      }
    });
  }
});
