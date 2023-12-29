const express = require('express');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const session = require('express-session');
const dotenv = require('dotenv');
const path = require('path');
const cors = require('cors');
const passport = require('passport');

const app = express();

// socket.io
const http = require('http').createServer(app);
// const { Server } = require('socket.io');
const io = require('socket.io')(http);
// const io = new Server(http);
// Swagger
const { swaggerUi, specs } = require('./swagger/swagger');

dotenv.config();


// 라우터 넣을 곳
const shopRouter = require('./routers/shop')
const { connect } = require('./database/index');
const passportConfig = require('./passport');



// 라우터 가져오기
const userRouter = require('./routes/user')
const mainRouter = require('./routes/index')
const testRouter = require('./routes/index');
const communityRouter = require('./routes/community');
app.set('port', process.env.PORT || 8088);
passportConfig();
connect();
app.set('view engine', 'ejs'); 
app.set('views', path.join(__dirname, 'views')); 



app.use(cors({
  // origin: 'https://minton1000.netlify.app',
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

app.use('/community-docs', swaggerUi.serve, swaggerUi.setup(specs));

// req.user 사용
app.use((req, res, next) => {
  res.locals.user = req.user;
  next();
});


// 라우터를 미들웨어로 등록
app.use('/user', userRouter)
app.use('/', mainRouter)

// socket 테스트
app.get('/socket', (req, res) => {
  res.render('socket.ejs');
})
// socket
io.on('connection', (socket) => {
  // 생각해보기 대화내용 db저장
  // 
  console.log('유저접속됨');
  
  socket.on('getIn', (server) => {
    console.log(server);
    const msg = server.id + '님이 입장하였습니다!'
    socket.join(server.server);
    io.to(server.server).emit('open', msg);
  });

  socket.on('getOut', (data) => {
    console.log(data);
    const msg = data.id + '님이 퇴장하였습니다!'
    socket.leave(data.server);
    io.to(data.server).emit('close', msg);
  });

  socket.on('userSend', (data) => {
    console.log('유저가 보낸 메세지:', data.msg);
    console.log('유저아이디:', data.id);
    // socket.join(data.room);
    if (data.room) {
      io.to(data.room).emit('sendMsg', data);
    } else {
      // 전체메세지로 감
      io.emit('sendMsg', false);
    }
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