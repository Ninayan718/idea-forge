/* 想法炼炉 · 发散引擎
 * 单页想法发散工具：输入一个模糊念头，用多种思维动作把想法炸成树。
 * 数据全部存浏览器 localStorage，不上云。
 */
(function () {
  "use strict";

  // ---------- 存储 ----------
  var LS_SETTINGS = "ideaforge.settings";
  var LS_TREES = "ideaforge.trees";
  var LS_ACTIVE = "ideaforge.active";

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(LS_SETTINGS)) || {}; }
    catch (e) { return {}; }
  }
  function saveSettings(s) { localStorage.setItem(LS_SETTINGS, JSON.stringify(s)); }
  function loadTrees() {
    try { return JSON.parse(localStorage.getItem(LS_TREES)) || []; }
    catch (e) { return []; }
  }
  function saveTrees(t) { localStorage.setItem(LS_TREES, JSON.stringify(t)); }

  // ---------- 领域词库 / 思维卡（复用 think3「抽一张思维卡」概念）----------
  var FAR_DOMAINS = [
    "生物进化", "蚂蚁群落", "免疫系统", "烹饪", "战争博弈", "音乐作曲", "建筑设计",
    "河流生态系统", "电力系统", "游戏关卡设计", "城市规划", "海洋洋流", "火山活动",
    "计算机病毒", "物流网络", "戏剧结构", "农业生产", "钟表机械", "神经网络",
    "森林火灾", "货币体系", "语言演化", "体育竞技", "摄影构图", "蜂群", "潮汐",
    "监狱管理", "搜索引擎", "酿酒发酵", "迷宫"
  ];

  var THINK_CARDS = [
    "反过来想：怎么让它彻底失败？",
    "类比到自然界的一个系统",
    "讲给一个 5 岁小孩听",
    "如果预算为 0 怎么办",
    "如果必须在 24 小时内做出来",
    "去掉一个你认为最核心的约束",
    "换成你最强劲对手的视角",
    "把这个想法极端化到荒谬的程度",
    "缩小到最小可行的一小步",
    "时间快进 10 年再看它",
    "如果它变成一个游戏会怎样",
    "用一句口号逼出它的本质"
  ];

  var MODE_LABEL = {
    root: "原始念头", perspective: "多视角", scamper: "SCAMPER",
    first: "第一性原理", reverse: "反向", reframe: "问题重述",
    card: "思维卡", collide: "跨界对撞", hybrid: "双想法杂交"
  };

  // ---------- 状态 ----------
  var state = {
    trees: loadTrees(),
    activeId: localStorage.getItem(LS_ACTIVE) || null,
    selectedId: null
  };

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

  function activeTree() {
    return state.trees.filter(function (t) { return t.id === state.activeId; })[0] || null;
  }
  function activeRoot() {
    var t = activeTree();
    return t ? t.root : null;
  }
  function findNode(node, id) {
    if (!node) return null;
    if (node.id === id) return node;
    for (var i = 0; i < node.children.length; i++) {
      var r = findNode(node.children[i], id);
      if (r) return r;
    }
    return null;
  }
  function getNode(id) { return findNode(activeRoot(), id); }

  // ---------- Prompt 构建（核心资产）----------
  function sample(arr, n) {
    var a = arr.slice(), out = [];
    while (out.length < n && a.length) {
      out.push(a.splice(Math.floor(Math.random() * a.length), 1)[0]);
    }
    return out;
  }

  function buildPrompt(mode, text, extra) {
    var sys = "你是一个帮助人类发散思维、产生创新想法的思考陪练。" +
      "任务：从一个想法或问题出发，产出多条具体、彼此不同、有启发性的变体或视角。" +
      "不要解释、不要客套、不要序号以外的标记。每条不超过 40 字。" +
      "用数字编号（1. 2. 3.）分行给出。";
    var user = "";
    switch (mode) {
      case "perspective":
        user = "从多个视角对这个想法做切入，每个视角给 1-2 条新角度或子问题" +
          "（覆盖：用户 / 技术 / 商业 / 社会 / 伦理 / 历史 / 竞品）：\n想法：" + text;
        break;
      case "scamper":
        user = "用 SCAMPER 七法（替代 / 组合 / 调整 / 修改 / 挪作他用 / 消除 / 反转）" +
          "对这个想法变形，给出 5-7 条具体变体：\n想法：" + text;
        break;
      case "first":
        user = "剥掉这个想法里『大家都这么认为』的隐含假设，回到最底层事实，" +
          "推导 3-5 条反直觉的新方向：\n想法：" + text;
        break;
      case "reverse":
        user = "假设这个想法必然失败，列出导致失败的 5 个原因 / 漏洞，" +
          "每条可转化为要规避或反向利用的新思路：\n想法：" + text;
        break;
      case "reframe":
        user = "把这个想法背后的问题用 5 种完全不同的说法重写，" +
          "每种可能引出不同解法：\n想法：" + text;
        break;
      case "card": {
        var card = THINK_CARDS[Math.floor(Math.random() * THINK_CARDS.length)];
        user = "抽到的思维卡是「" + card + "」。请用这张卡的视角 / 约束，" +
          "对这个想法给出 4-5 条被它激发的新思路：\n想法：" + text;
        break;
      }
      case "collide": {
        var ds = sample(FAR_DOMAINS, 3);
        user = "把下面这个想法强行类比到几个毫无关系的领域：" + ds.join("、") +
          "。对每个领域给出 1 个由此启发的跨界点子：\n想法：" + text;
        break;
      }
      case "hybrid":
        user = "把下面两个想法杂交，生成 3-5 个融合两者的『混血体』新点子：\n" +
          "想法A：" + text + "\n想法B：" + (extra || "");
        break;
    }
    return { sys: sys, user: user };
  }

  function parseItems(text) {
    var lines = text.split("\n").map(function (s) { return s.trim(); }).filter(Boolean);
    var items = [];
    var re = /^\d+[.、)]\s*(.*)$/;
    for (var i = 0; i < lines.length; i++) {
      var m = lines[i].match(re);
      if (m) { items.push(m[1].trim()); }
      else if (/^[-*•]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*•]\s+/, "").trim());
      }
    }
    if (items.length === 0) {
      if (lines.length > 1) return lines.slice(0, 10);
      return [text.trim()];
    }
    return items.slice(0, 12);
  }

  // ---------- AI 流式调用 ----------
  function callAI(sys, user) {
    var s = loadSettings();
    // 默认走魔搭 ModelScope API-Inference：国内可达、OpenAI 兼容、chat 接口已开放浏览器跨域(CORS)、有免费额度
    var base = (s.baseURL || "https://api-inference.modelscope.cn/v1").replace(/\/+$/, "");
    var model = s.model || "Qwen/Qwen3.8-Flash-Next";
    var body = {
      model: model,
      messages: [{ role: "system", content: sys }, { role: "user", content: user }],
      stream: true,
      temperature: 0.9
    };
    var headers = { "Content-Type": "application/json" };
    if (s.apiKey) headers["Authorization"] = "Bearer " + s.apiKey;

    // 防止目标接口连不上/被墙时 fetch 永久挂起 → 一直「生成中」看不到结果
    var controller = new AbortController();
    var gotFirst = false;
    var watchdog = setTimeout(function () { if (!gotFirst) controller.abort(); }, 30000);

    return fetch(base + "/chat/completions", {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
      signal: controller.signal
    }).then(function (res) {
      if (!res.ok) {
        return res.text().then(function (t) {
          throw new Error("API " + res.status + "：" + t.slice(0, 200));
        });
      }
      var reader = res.body.getReader();
      var dec = new TextDecoder();
      var buf = "";
      var stopped = false;
      return {
        cancel: function () { stopped = true; reader.cancel(); },
        next: function () {
          if (stopped) return Promise.resolve({ done: true, value: "" });
          return reader.read().then(function (r) {
            if (r.done) return { done: true, value: "" };
            buf += dec.decode(r.value, { stream: true });
            var lines = buf.split("\n");
            buf = lines.pop();
            var out = "";
            for (var i = 0; i < lines.length; i++) {
              var line = lines[i].trim();
              if (!line || line.indexOf("data:") !== 0) continue;
              var data = line.slice(5).trim();
              if (data === "[DONE]") { stopped = true; break; }
              try {
                var j = JSON.parse(data);
                var c = j.choices && j.choices[0] && j.choices[0].delta && j.choices[0].delta.content;
                if (c) { out += c; gotFirst = true; clearTimeout(watchdog); }
              } catch (e) { /* ignore partial */ }
            }
            return { done: false, value: out };
          });
        }
      };
    }, function (err) {
      clearTimeout(watchdog);
      throw err;
    });
  }

  // ---------- 生成 ----------
  var generating = false;

  function generate(nodeId, mode) {
    if (generating) { toast("正在生成中，稍候…"); return; }
    var node = getNode(nodeId);
    if (!node) return;
    var extra = "";
    if (mode === "hybrid") {
      var others = state.trees
        .filter(function (t) { return t.id !== state.activeId; })
        .map(function (t) { return t.root.text; });
      var def = others.length ? others[0] : "";
      var b = window.prompt("输入要杂交的第二个想法（或从想法库挑一个）：", def);
      if (b == null) return;
      extra = b.trim();
      if (!extra) return;
    }

    var p = buildPrompt(mode, node.text, extra);
    generating = true;
    setToolbarBusy(true);

    // 占位生成节点
    var ph = { id: uid(), text: "生成中…", mode: mode, generative: true, children: [], status: "pending" };
    node.children.push(ph);
    renderTree();

    callAI(p.sys, p.user).then(function (stream) {
      var acc = "";
      function step() {
        return stream.next().then(function (res) {
          if (res.done) {
            finish();
            return;
          }
          acc += res.value;
          updateNodeText(ph.id, acc || "生成中…");
          return step();
        });
      }
      function finish() {
        var items = parseItems(acc);
        // 用真实条目替换占位
        node.children = node.children.filter(function (c) { return c !== ph; });
        items.forEach(function (t) {
          node.children.push({ id: uid(), text: t, mode: mode, children: [], status: "pending" });
        });
        generating = false;
        setToolbarBusy(false);
        saveTrees(state.trees);
        renderTree();
      }
      return step();
    }).catch(function (err) {
      node.children = node.children.filter(function (c) { return c !== ph; });
      generating = false;
      setToolbarBusy(false);
      saveTrees(state.trees);
      renderTree();
      toast(friendlyError(err));
    });
  }

  // 把底层错误翻译成人话，并指向可行的解决办法
  function friendlyError(err) {
    if (err && err.name === "AbortError") {
      return "超时：30 秒内无响应，多半是网络连不上该接口或接口未返回。检查「设置」里的 Base URL 与网络；若目标接口未开放浏览器跨域，请用本地代理 server.js";
    }
    var m = (err && err.message) || String(err);
    if (/400/.test(m) && /has no provider supported/i.test(m)) {
      return "模型不可用（400）：该模型未在魔搭 API-Inference 部署，无法调用。请打开「设置」点「刷新」从列表里换一个当前可用的模型。";
    }
    if (/400/.test(m)) {
      return "请求被拒（400）：" + m.replace(/^API 400：/, "") + "。检查模型名或参数是否正确。";
    }
    if (/Failed to fetch|NetworkError|Load failed|TypeError/i.test(m)) {
      return "网络/跨域错误：" + m + "。若是 CORS 跨域被拦，建议用本地代理 server.js（密钥不进前端）";
    }
    return "出错：" + m;
  }

  function updateNodeText(id, txt) {
    var el = document.querySelector('[data-id="' + id + '"] .node-text');
    if (el) el.textContent = txt;
  }

  // ---------- 渲染 ----------
  function el(tag, cls, txt) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (txt != null) e.textContent = txt;
    return e;
  }

  function renderLibrary() {
    var list = document.getElementById("treeList");
    list.innerHTML = "";
    state.trees.slice().reverse().forEach(function (t) {
      var item = el("div", "lib-item" + (t.id === state.activeId ? " active" : ""));
      var head = el("div");
      head.appendChild(el("span", null, t.root.text.slice(0, 28)));
      var del = el("span", "del", "✕");
      del.title = "删除";
      del.onclick = function (ev) { ev.stopPropagation(); deleteTree(t.id); };
      head.appendChild(del);
      item.appendChild(head);
      var meta = el("div", "meta", formatDate(t.root.createdAt) + " · " + countNodes(t.root) + " 节点");
      item.appendChild(meta);
      item.onclick = function () { state.activeId = t.id; state.selectedId = t.root.id; persist(); renderAll(); };
      list.appendChild(item);
    });
  }

  function countNodes(n) {
    var c = 1;
    n.children.forEach(function (k) { c += countNodes(k); });
    return c;
  }
  function formatDate(ts) {
    var d = new Date(Number(ts));
    if (isNaN(d)) return "";
    var p = function (x) { return (x < 10 ? "0" : "") + x; };
    return (d.getMonth() + 1) + "/" + d.getDate() + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }

  function renderTree() {
    var root = document.getElementById("treeRoot");
    root.innerHTML = "";
    var t = activeTree();
    if (!t) {
      root.appendChild(el("div", "empty", "左侧「+ 新建想法」或上方输入框，丢一个念头进来开始发散。"));
      document.getElementById("toolbar").classList.add("hidden");
      return;
    }
    document.getElementById("toolbar").classList.remove("hidden");
    if (!state.selectedId) state.selectedId = t.root.id;
    root.appendChild(renderNode(t.root));
    updateSelLabel();
  }

  function renderNode(node) {
    var card = el("div", "node" + (node.id === state.selectedId ? " selected" : "") +
      (node.status === "adopted" ? " adopted" : "") +
      (node.status === "discarded" ? " discarded" : "") +
      (node.generative ? " generative" : ""));
    card.setAttribute("data-id", node.id);
    card.onclick = function (ev) {
      if (ev.target.closest(".node-actions")) return;
      state.selectedId = node.id;
      persist();
      // 更新选中高亮
      document.querySelectorAll(".node.selected").forEach(function (n) { n.classList.remove("selected"); });
      card.classList.add("selected");
      updateSelLabel();
    };

    var head = el("div", "node-head");
    head.appendChild(el("span", "tag " + node.mode, MODE_LABEL[node.mode] || node.mode));
    card.appendChild(head);

    var txt = el("div", "node-text", node.text);
    card.appendChild(txt);

    // 行为按钮
    var acts = el("div", "node-actions");
    if (node.mode !== "root") {
      var ok = el("button", "mini ok", "采纳");
      ok.onclick = function (ev) { ev.stopPropagation(); node.status = "adopted"; saveTrees(state.trees); renderTree(); };
      var no = el("button", "mini no", "丢弃");
      no.onclick = function (ev) { ev.stopPropagation(); node.status = "discarded"; saveTrees(state.trees); renderTree(); };
      acts.appendChild(ok); acts.appendChild(no);
    }
    card.appendChild(acts);

    var wrap = el("div");
    wrap.appendChild(card);
    if (node.children && node.children.length) {
      var kids = el("div", "children");
      node.children.forEach(function (c) { kids.appendChild(renderNode(c)); });
      wrap.appendChild(kids);
    }
    return wrap;
  }

  function updateSelLabel() {
    var n = getNode(state.selectedId);
    document.getElementById("selText").textContent = n ? (n.text.slice(0, 16) + (n.text.length > 16 ? "…" : "")) : "—";
  }

  function setToolbarBusy(busy) {
    document.querySelectorAll("#toolbar .tbtn").forEach(function (b) {
      b.disabled = busy; b.style.opacity = busy ? .5 : 1;
    });
  }

  function renderAll() { renderLibrary(); renderTree(); }

  // ---------- 操作 ----------
  function newTree() {
    state.activeId = null;
    state.selectedId = null;
    persist();
    renderAll();
    document.getElementById("ideaInput").focus();
  }

  function startFromInput() {
    var v = document.getElementById("ideaInput").value.trim();
    if (!v) { toast("先写点什么…"); return; }
    var t = {
      id: uid(),
      root: { id: uid(), text: v, mode: "root", children: [], status: "pending", createdAt: Date.now() },
      createdAt: Date.now()
    };
    state.trees.push(t);
    state.activeId = t.id;
    state.selectedId = t.root.id;
    document.getElementById("ideaInput").value = "";
    persist();
    renderAll();
    toast("已建立想法树，点下方按钮开始发散");
  }

  function deleteTree(id) {
    if (!window.confirm("删除这个想法树？不可恢复。")) return;
    state.trees = state.trees.filter(function (t) { return t.id !== id; });
    if (state.activeId === id) { state.activeId = null; state.selectedId = null; }
    persist();
    renderAll();
  }

  function persist() {
    saveTrees(state.trees);
    if (state.activeId) localStorage.setItem(LS_ACTIVE, state.activeId);
    else localStorage.removeItem(LS_ACTIVE);
  }

  function toast(msg) {
    var t = document.getElementById("toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { t.classList.remove("show"); }, 2200);
  }

  // ---------- 设置 ----------
  function openSettings() {
    var s = loadSettings();
    document.getElementById("setBase").value = s.baseURL || "";
    document.getElementById("setKey").value = s.apiKey || "";
    var sel = document.getElementById("setModel");
    var cur = s.model || "Qwen/Qwen3.8-Flash-Next";
    // 确保默认项存在，避免下拉为空导致 value 为空
    var exists = false;
    for (var i = 0; i < sel.options.length; i++) {
      if (sel.options[i].value === cur) { exists = true; break; }
    }
    if (!exists) {
      var o = document.createElement("option");
      o.value = cur; o.textContent = cur + "（默认）";
      sel.appendChild(o);
    }
    sel.value = cur;
    document.getElementById("testResult").textContent = "";
    document.getElementById("settingsModal").classList.remove("hidden");
  }
  // 从魔搭拉当前可用模型列表，填充下拉；列表里也未必都能调，但比硬编码准
  function refreshModels() {
    var base = document.getElementById("setBase").value.trim().replace(/\/+$/, "") || "https://api-inference.modelscope.cn/v1";
    var key = document.getElementById("setKey").value.trim();
    var sel = document.getElementById("setModel");
    var btn = document.getElementById("refreshModels");
    btn.disabled = true; btn.textContent = "刷新中…";
    var headers = {};
    if (key) headers["Authorization"] = "Bearer " + key;
    fetch(base + "/models", { headers: headers })
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .then(function (j) {
        var ids = (j.data || []).map(function (m) { return m.id; });
        var cur = sel.value;
        sel.innerHTML = "";
        ids.forEach(function (id) {
          var o = document.createElement("option");
          o.value = id; o.textContent = id;
          sel.appendChild(o);
        });
        if (cur) sel.value = cur;
        btn.disabled = false; btn.textContent = "刷新";
        toast("已拉取 " + ids.length + " 个模型，挑一个可用的即可");
      })
      .catch(function (e) {
        btn.disabled = false; btn.textContent = "刷新";
        toast("拉取模型列表失败：" + (e.message || e) + "（仍可手动在设置里直接输入模型名）");
      });
  }
  function closeSettings() { document.getElementById("settingsModal").classList.add("hidden"); }
  function saveSettingsUI() {
    var s = {
      baseURL: document.getElementById("setBase").value.trim(),
      apiKey: document.getElementById("setKey").value.trim(),
      model: document.getElementById("setModel").value.trim()
    };
    saveSettings(s);
    closeSettings();
    toast("设置已保存");
  }
  function testConnection() {
    var base = document.getElementById("setBase").value.trim().replace(/\/+$/, "") || "https://api-inference.modelscope.cn/v1";
    var key = document.getElementById("setKey").value.trim();
    var model = document.getElementById("setModel").value.trim() || "Qwen/Qwen3.8-Flash-Next";
    var res = document.getElementById("testResult");
    res.textContent = "测试中…";
    var headers = { "Content-Type": "application/json" };
    if (key) headers["Authorization"] = "Bearer " + key;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, 20000);
    fetch(base + "/chat/completions", {
      method: "POST",
      headers: headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model: model,
        messages: [{ role: "user", content: "回复 ok 两个字" }],
        stream: false,
        max_tokens: 8
      })
    })
      .then(function (r) {
        clearTimeout(t);
        if (r.ok) { res.textContent = "✓ 连通（" + r.status + "）"; return; }
        return r.text().then(function (txt) { res.textContent = "✗ " + r.status + " " + txt.slice(0, 120); });
      })
      .catch(function (e) {
        clearTimeout(t);
        res.textContent = "✗ " + (e.message || e) + (e.name === "AbortError" ? "（超时）" : "（若跨域被拦，该接口可能未开放浏览器访问）");
      });
  }

  // ---------- 绑定 ----------
  function bind() {
    document.getElementById("newBtn").onclick = newTree;
    document.getElementById("startBtn").onclick = startFromInput;
    document.getElementById("ideaInput").addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") startFromInput();
    });
    document.getElementById("settingsBtn").onclick = openSettings;
    document.getElementById("setCancel").onclick = closeSettings;
    document.getElementById("setSave").onclick = saveSettingsUI;
    document.getElementById("testBtn").onclick = testConnection;
    document.getElementById("refreshModels").onclick = refreshModels;
    document.getElementById("settingsMask").onclick = function (e) {
      if (e.target.id === "settingsMask") closeSettings();
    };
    document.querySelectorAll("#toolbar .tbtn").forEach(function (b) {
      b.onclick = function () {
        if (!state.selectedId) { toast("先在树上点选一个节点"); return; }
        generate(state.selectedId, b.getAttribute("data-mode"));
      };
    });
  }

  bind();
  renderAll();
})();
