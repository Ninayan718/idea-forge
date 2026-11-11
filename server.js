/* 想法炼炉 · 本地代理(可选)
 * 作用：
 *   1) 托管当前目录的静态文件(index.html / app.js)
 *   2) 代理 POST /chat/completions 到真正的上游，注入密钥并流式转发
 * 这样浏览器里 Base URL 填 http://localhost:8787、密钥留空即可，
 * 既绕开 CORS，又不把密钥写进前端。
 *
 * 用法：
 *   UPSTREAM=https://api.openai.com/v1 API_KEY=sk-xxx node server.js
 *   (不传则用文件顶部默认值)
 */
"use strict";
var http = require("http");
var https = require("https");
var fs = require("fs");
var path = require("path");

var PORT = process.env.PORT || 8787;
var UPSTREAM = (process.env.UPSTREAM || "https://api.openai.com/v1").replace(/\/+$/, "");
var API_KEY = process.env.API_KEY || "";

var ROOT = __dirname;
var MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".json": "application/json"
};

function serveStatic(req, res) {
  var urlPath = req.url.split("?")[0];
  if (urlPath === "/") urlPath = "/index.html";
  var file = path.join(ROOT, path.normalize(urlPath));
  if (file.indexOf(ROOT) !== 0) { res.writeHead(403); res.end("forbidden"); return; }
  fs.readFile(file, function (err, data) {
    if (err) { res.writeHead(404); res.end("not found"); return; }
    var ext = path.extname(file).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(data);
  });
}

function proxyChat(req, res) {
  var body = "";
  req.on("data", function (c) { body += c; });
  req.on("end", function () {
    var u = new URL(UPSTREAM + "/chat/completions");
    var opts = {
      method: "POST",
      hostname: u.hostname,
      port: u.port || (u.protocol === "https:" ? 443 : 80),
      path: u.pathname + u.search,
      headers: { "Content-Type": "application/json" }
    };
    if (API_KEY) opts.headers["Authorization"] = "Bearer " + API_KEY;

    var client = u.protocol === "https:" ? https : http;
    var p = client.request(opts, function (up) {
      res.writeHead(up.statusCode, {
        "Content-Type": up.headers["content-type"] || "text/event-stream",
        "Cache-Control": "no-cache"
      });
      up.on("data", function (d) { res.write(d); });
      up.on("end", function () { res.end(); });
    });
    p.on("error", function (e) {
      res.writeHead(502, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: e.message }));
    });
    p.write(body);
    p.end();
  });
}

var server = http.createServer(function (req, res) {
  if (req.method === "POST" && req.url.indexOf("/chat/completions") === 0) {
    proxyChat(req, res);
  } else if (req.method === "GET" || req.method === "HEAD") {
    serveStatic(req, res);
  } else {
    res.writeHead(405); res.end("method not allowed");
  }
});

server.listen(PORT, function () {
  console.log("想法炼炉本地代理已启动: http://localhost:" + PORT);
  console.log("上游: " + UPSTREAM + (API_KEY ? " (已注入密钥)" : " (未设置密钥, 需在设置里填)"));
});
