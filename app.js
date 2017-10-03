const koa = require('koa')
const app = new koa()
const path = require('path')
const serve = require('koa-static');
const views = require('koa-views');
const router = require('koa-router')();

const { Server } = require("http");
const SocketIO = require("socket.io");

const server = Server(app.callback());

const io = SocketIO(server);
const namespace = '/webrtc-demo';
const idPrefix = namespace + '#';
let ns = io.of(namespace);


app.use(views(path.join(__dirname, 'views'), { extension: 'pug' }))

const publicFiles = serve(path.join(__dirname, 'public'));
app.use(publicFiles);

router.get('/', async function (ctx, next) {
  await ctx.render('index')
})

app
.use(router.routes())
.use(router.allowedMethods());
// catch 404 and forward to error handler
app.use(async function (ctx, next) {
  var err = new Error('Not Found');
  err.status = 404;
  next(err);
});

// 参加者一覧のオブジェクト
let peers = {};

ns.on('connection', (socket) => {
  /**
   * チャットルームに入室した
   */
  socket.on('login', (data) => {
    // 参加者一覧のオブジェクトに追加
    let joinedAt = new Date().toISOString();
    peers[socket.id] = {
      id: socket.id,
      userName: data.userName,
      joinedAt: joinedAt
    };
    // 参加成功を通知
    socket.emit('joined', { success: true, joinedAt: joinedAt });
    // 参加者リストを通知
    updateMembers();
  });

  /**
   * 接続が切断された
   */
  socket.on('disconnect', () => {
    delete peers[socket.id];
    // 参加者リストを通知
    updateMembers();
  });

  /**
   * 他ユーザ宛てのメッセージが送信された
   */
  socket.on('signaling', (data) => {
    if (!data.to) {
      // 宛先が指定されていなかったら無視
      return;
    }
    // data.toで指定されたユーザにメッセージをそのまま転送
    ns.to(data.to).emit('signaling', data);
  });
});

// 参加者リストを通知
function updateMembers() {
  // 参加者リストを生成
  let peerList = Object.keys(ns.sockets).map((id) => {
    return peers[id]
  }).filter((peer) => {
    return !!peer;
  });
  // ピア全員に参加者の情報を送信
  ns.emit('update peers', peerList);
}

module.exports = {
  app: app,
  server: server
};
