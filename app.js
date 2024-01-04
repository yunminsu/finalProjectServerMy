const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const passport = require('passport');
const api = require('./swagger/swagger')


const app = express();  

// socket.io
const http = require('http').createServer(app);
// const { Server } = require('socket.io');
const io = require('socket.io')(http, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});
// const io = new Server(http);
// Swagger
const { swaggerUi, specs } = require('./swagger/swagger');

dotenv.config();


// 라우터 넣을 곳
const shopRouter = require('./routes/shop')
const { connect, client } = require('./database/index');
const db = client.db('lastTeamProject');
const passportConfig = require('./passport');



// 라우터 가져오기
const userRouter = require('./routes/user')
const mainRouter = require('./routes/index')
const testRouter = require('./routes/index');
const communityRouter = require('./routes/community');
const vintageCommunityRouter = require('./routes/vintage')
app.set('port', process.env.PORT || 8088);
passportConfig();
connect();
app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname, 'views')); 



app.use(cors({
  // origin: 'https://minton1000.netlify.app',
  origin: 'http://localhost:3000',
  credentials: true
}));
app.use(morgan('dev'));
app.use('/', express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(express.json())
app.use(session({
  resave: false,
  saveUninitialized: false,
  secret: process.env.COOKIE_SECRET,
  cookie: {
    httpOnly: true,
    secure: false,
  },
  name: 'session-cookie'
}));


// 미들웨어 라우터 넣을 곳

app.use('/shop', shopRouter);
app.use('/', testRouter);
app.use('/community', communityRouter)
// passport 미들웨어 설정
app.use(passport.initialize());
app.use(passport.session());



// req.user 사용
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});


// 라우터를 미들웨어로 등록
app.use('/user', userRouter)
app.use('/', mainRouter)
app.use('/vintage', vintageCommunityRouter)

// socket 테스트
app.get('/socket', (req, res) => {
  res.render('socket.ejs');
})
// socket
io.on('connection', (socket) => {
  // 생각해보기 대화내용 db저장
  // 채팅방 입장 시 chat 컬렉션에 title: 입장한 유저(2명)의 닉네임 데이터 생성
  // 채팅할 때마다 

  // 해당 방에 join할 때 이전 채팅 값 불러오기, 채팅 칠 때마다 db에 저장(누가보냈는지), 시간...
  console.log('유저접속됨');
  
  socket.on('getIn', async (server) => {
    console.log(server);
    const chatData = await db.collection('chat').find({ user1: server.server, user2: server.id });
    const msg = server.id + '님이 입장하였습니다!'
    socket.join(server.server);
    const resulte = { chatData, msg }
    io.to(server.server).emit('open', resulte);
  });

  socket.on('getOut', (data) => {
    console.log(data);
    const msg = data.id + '님이 퇴장하였습니다!'
    socket.leave(data.server);
    io.to(data.server).emit('close', msg);
  });

  socket.on('userSend', async (data) => {
    console.log('유저가 보낸 메세지:', data.msg);
    console.log('유저아이디:', data.id);

    const findChat = await db.collection('chat').find({ user1: data.room, user2: data.id });
    if (!findChat) {
      await db.collection('chat').insertOne({ user1: data.room, user2: data.id });
      
    }
    const findUser = await db.collection('chat').find({ user1: data.room, user2: data.id });
    if (findUser.user1 === data.room) {
      await db.collection('chat').updateOne({ user1: data.room, user2: data.id }, { $push: { user1Chat: data.msg } });
    } else if (findUser.user2 === data.room) {
      
    }
    if (data.room) {
      io.emit('sendMsg', data);
    } else {
      // 전체메세지로 감
      io.emit('sendMsg', false);
    }
  });

  // didi
  socket.on('didis', async (data) => {
    await db.collection('chat').insertOne({ user1: data.userId, user2: data.me });
    const resulte = await db.collection('chat').findOne({ user1: data.userId, user2: data.me });
    const roomId = resulte._id;
    const chatRequester = resulte.user2;
    const msg = data.msg;

    socket.join(roomId);
    const res = { chatRequester, msg }
    io.to(roomId).emit('res', res);
  });


});



app.use((req, res, next) => {
  const error = new Error(`${req.method} ${req.url} 라우터가 없습니다.`);
  error.status = 404;
  next(error);
});

app.use((err, req, res, next) => {
  console.error(err)
  res.locals.message = err.message;
  res.locals.error = process.env.NODE_ENV !== 'production' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

http.listen(app.get('port'), () => {
  console.log(app.get('port') + '번에서 서버 실행 중입니다.');
});