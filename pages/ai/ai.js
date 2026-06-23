// pages/ai/ai.js — AI 对话、快捷需求、历史、语音播报
const { request } = require("../../utils/request.js");
const { formatRouteJsonForDisplay } = require("../../utils/aiReplyFormat.js");
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
      content:
        m.role === "assistant" ? formatRouteJsonForDisplay(m.content || "") : m.content
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

  /** 自由输入不传 demand_type，由后端根据全文关键词分类（避免误标成 qa） */
  _inferAndSend(text) {
    this._sendWithType(text, null);
  },

  _sendWithType(text, demandType) {
    const msgs = this.data.messages.concat([
      { id: "u" + Date.now(), role: "user", content: text }
    ]);
    this.setData({ messages: msgs, input: "", scrollTo: "msg-" + (msgs.length - 1) });
    wx.showLoading({ title: "思考中" });
    const payload = {
      content: text,
      openid: (app.globalData.userInfo && app.globalData.userInfo.openid) || ""
    };
    if (demandType) {
      payload.demand_type = demandType;
    }
    request("/api/ai/chat", { method: "POST", data: payload })
      .then((body) => {
        wx.hideLoading();
        const data = body.data || body;
        const rawReply = data.reply || data.content || "暂无回复";
        const reply = formatRouteJsonForDisplay(rawReply);
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

  clearHistory() {
    wx.showModal({
      title: "清空对话",
      content: "将删除本页全部聊天记录，并同步清空服务端已保存的对话（需已登录）。是否继续？",
      confirmText: "清空",
      confirmColor: "#c62828",
      success: (res) => {
        if (!res.confirm) return;
        try {
          wx.removeStorageSync(STORAGE_KEY);
        } catch (e) {}
        this.setData({
          messages: [],
          input: "",
          scrollTo: "",
          lastAssistantText: "",
          lastAudioUrl: ""
        });
        const token =
          (app.globalData && app.globalData.token) || wx.getStorageSync("token") || "";
        if (!token) {
          wx.showToast({ title: "已清空本地记录", icon: "none" });
          return;
        }
        request("/api/chat/history/clear", { method: "DELETE" })
          .then(() => {
            wx.showToast({ title: "已清空", icon: "success" });
          })
          .catch(() => {
            wx.showToast({ title: "本地已清空", icon: "none" });
          });
      }
    });
  },

  takePhoto() {
    const that = this;
    wx.chooseMedia({
      count: 1,
      mediaType: ["image"],
      sourceType: ["camera", "album"],
      sizeType: ["compressed"],
      success(res) {
        that._recognizeAnimal(res.tempFiles[0].tempFilePath);
      },
      fail(err) {
        if (err.errMsg.indexOf("cancel") === -1) {
          wx.showToast({ title: "拍照或选图失败", icon: "none" });
        }
      }
    });
  },

  _recognizeAnimal(filePath) {
    const that = this;
    const placeholderId = "r" + Date.now();
    const msgs = this.data.messages.concat([
      { id: placeholderId, role: "user", content: "正在识别照片中的动物…" }
    ]);
    this.setData({
      messages: msgs,
      input: "",
      scrollTo: "msg-" + (msgs.length - 1)
    });
    wx.showLoading({ title: "识别中" });

    const fs = wx.getFileSystemManager();
    let base64;
    try {
      base64 = fs.readFileSync(filePath, "base64");
    } catch (e) {
      wx.hideLoading();
      wx.showToast({ title: "图片读取失败", icon: "none" });
      this._removePlaceholder(placeholderId);
      return;
    }

    const token = (app.globalData && app.globalData.token) || wx.getStorageSync("token") || "";
    const base = require("../../utils/request.js").getApiBase();

    wx.request({
      url: base + "/api/ai/recognize-animal",
      method: "POST",
      timeout: 60000,
      data: { image_base64: base64 },
      header: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: "Bearer " + token } : {})
      },
      success(res) {
        wx.hideLoading();
        const body = res.data;
        if (res.statusCode === 200 && body && body.code === 0) {
          const d = body.data;
          const animalName = d.animal_name || "未知动物";
          const confidence = d.confidence != null ? (d.confidence * 100).toFixed(0) + "%" : "";
          const explanation = d.explanation || "";
          const scenic = d.related_scenic;
          let displayText = "识别结果：" + animalName;
          if (confidence) displayText += "（置信度 " + confidence + "）";
          displayText += "\n\n" + explanation;
          if (scenic && scenic.name) {
            displayText += "\n\n相关展区：" + scenic.name;
          }
          const list = that.data.messages.map(m => {
            if (m.id === placeholderId) {
              return { id: "u" + Date.now(), role: "user", content: "我拍了一张动物照片" };
            }
            return m;
          });
          const newList = list.concat([
            { id: "a" + Date.now(), role: "assistant", content: displayText, audio_url: "" }
          ]);
          that.setData({
            messages: newList,
            lastAssistantText: displayText,
            lastAudioUrl: "",
            scrollTo: "msg-" + (newList.length - 1)
          });
          that._persistHistory(newList);
        } else {
          let msg = "识别失败";
          if (body && body.message) msg = body.message;
          if (body && body.detail) msg = JSON.stringify(body.detail).slice(0, 100);
          wx.showToast({ title: msg, icon: "none", duration: 3000 });
          that._removePlaceholder(placeholderId);
        }
      },
      fail(err) {
        wx.hideLoading();
        const em = (err && err.errMsg) || "";
        wx.showToast({ title: em.indexOf("timeout") >= 0 ? "识别超时" : "请求失败，请检查后端是否启动", icon: "none", duration: 3000 });
        that._removePlaceholder(placeholderId);
      }
    });
  },

  _removePlaceholder(id) {
    const filtered = this.data.messages.filter(m => m.id !== id);
    this.setData({ messages: filtered });
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
