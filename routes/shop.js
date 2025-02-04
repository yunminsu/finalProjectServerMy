const express = require('express');
const { client } = require('../database');
const db = client.db('lastTeamProject');
const { ObjectId } = require('mongodb');
const router = express.Router();

// S3
const multer = require('multer');
const multerS3 = require('multer-s3');
const { S3Client } = require('@aws-sdk/client-s3');
const { DeleteObjectCommand } = require('@aws-sdk/client-s3');


// S3
const s3 = new S3Client({
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY,
    secretAccessKey: process.env.AWS_ACCESS_KEY_SECRET
  },
  region: 'ap-northeast-2'
});

// S3 클라이언트
const upload = multer({
  storage: multerS3({
    s3,
    bucket: 'finaltp',
    key(req, file, cb) {
      cb(null, `original/${Date.now()}_${file.originalname}`)
    }
  }),
  limits: { fieldSize: 5 * 1024 * 1024 }
});


// 상품정보 불러오기 (전체)(초기 8개, 더보기 시 8개 추가)
router.get('/', async (req, res) => {
  let posts;
  if (req.query.nextId) {
    posts = await db.collection('shop').find({ _id: { $gt: new ObjectId(req.query.nextId) } }).limit(8).toArray();
  } else {
    posts = await db.collection('shop').find({}).limit(8).toArray();
  }
  // res.render('write.ejs', { posts })
  res.json({
    flag: true,
    message: '성공적으로 상품을 가져왔습니다.',
    posts
  });
});

// 상품정보 불러오기(초기 8개, 더보기 시 8개 추가)
// 상품 태그별로 보여주기 feed
// 현재 feed 뿐 만들어진 더미 없음 (이미지 없는 이슈..)
router.get('/feed', async (req, res) => {
  let posts;
  if (req.query.nextId) {
    posts = await db.collection('shop').find({ _id: { $gt: new ObjectId(req.query.nextId) }, tag: 'feed' }).limit(8).toArray();
  } else {
    posts = await db.collection('shop').find({ tag: 'feed' }).limit(8).toArray();
  }
  console.log(posts);
  // res.render('write.ejs', { posts })
  res.json({
    flag: true,
    message: '성공적으로 상품을 가져왔습니다.(feed)',
    posts
  });
});

// 장바구니 추가(로그인 한 사람)
router.post('/plusCart', async (req, res) => {
  const title = req.body.title;
  const price = req.body.price;
  const postId = req.body.postId;
  const count = req.body.productCount;
  try {
    const user = req.user._id;
    await db.collection('cart').insertOne({ title, price, count, postId: new ObjectId(postId), user });
    res.json({
      flag: true,
      message: '장바구니 추가 완료'
    });
  } catch (err) {
    console.error(err);
  }
});

// 수량 1개씩 추가 버튼
router.post('/plusCount', async (req, res) => {
  const postId = req.body.postId;
  const user = req.user._id;
  try {
    await db.collection('cart').updateOne({ postId, user }, { $inc: { count: 1 }});
    const result = await db.collection('cart').findOne({ postId, user });
    const count = result.count;
    res.json({
      flag: true,
      message: '카운트 +1 성공',
      count
    });
  } catch (err) {
    console.error(err);
  }
});

// 수량 1개씩 다운 버튼
router.post('/minusCount', async (req, res) => {
  const postId = req.body.postId;
  const user = req.user._id;
  try {
    const data = await db.collection('cart').findOne({ postId, user });
    if (data.count === '1' ) {
      throw new Error('1 이하로 감소시킬 수 없습니다');
    } else {
      await db.collection('cart').updateOne({ postId, user }, { $inc: { count: -1 }});
      const result = await db.collection('cart').findOne({ postId, user });
      const count = result.count;
      res.json({
        flag: true,
        message: '카운트 -1 성공',
        count
      });
    }
  } catch (err) {
    console.error(err);
    res.json({
      flag: false,
      message: err.message
    });
  }
});


// 상품 상세페이지 가져오기
router.get('/detail/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const itemDetail = await db.collection('shop').findOne({ _id: new ObjectId(postId) });
    // 상세정보 더미 만들고 내려줘야함 (지금없음)
    // const itemDetail = await db.collection('shop').findOne({ _id: new ObjectId(postId) });
    res.json({
      flag: true,
      message: '상세정보 불러오기 성공',
      itemDetail,
  
    });
  } catch (err) {
    console.error(err);
  }
});

// 상품 상세페이지_리뷰 가져오기
router.get('/review/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const itemReview = await db.collection('review').find({ postId: new ObjectId(postId) }).toArray();
    res.json({
      flag: true,
      message: '리뷰 불러오기 성공',
      itemReview
    });
  } catch (err) {
    console.error(err);
  }
});

// 상품 상세페이지_리뷰 작성하기
router.post('/reviewInsert/:postId', upload.single('img'), async (req, res) => {
  try {
    const postId = req.params.postId;
    const userId = req.body.userId;
    const brand = req.body.brand;
    const title = req.body.title;
    const content = req.body.content;
    const date = req.body.date;
    const imgUrl = req.file?.location || '';
    const imgKey = req.file?.key || '';
    await db.collection('review').insertOne({ brand, title, content, date, postId, imgUrl, imgKey });
    res.json({
      flag: true,
      message: '리뷰 등록 완료'
    });
  } catch (err) {
    console.error(err);
    res.json({
      flag: false,
      message: '리뷰 등록 실패'
    });
  };
});

// 상품 상세페이지_Q&A 가져오기
router.get('/qna/:postId', async (req, res) => {
  try {
    const postId = req.params.postId
    const itemQna = await db.collection('qna').find({ postId: new ObjectId(postId) }).toArray();
    res.json({
      flag: true,
      message: 'Q&N 불러오기 성공',
      itemQna
    });
  } catch (err) {
    console.error(err);
  }
});

// 상품 Q&A 작성하기
router.post('/qna/:postId', async (req, res) => {
  try {
    const postId = req.params.postId;
    const title = req.body.title;
    const content = req.body.content;
    await db.collection('qna').insertOne({ title, content, postId: new ObjectId(postId), status: '답변대기' });
    res.json({
      flag: true,
      message: 'Q&N 등록 완료'
    });
  } catch (err) {
    console.error(err);
  }
});

// 상품 Q&A 답변하기
router.patch('/qnaComment/:qnaPostId', async (req, res) => {
  try {
    const qnaPostId = req.params.qnaPostId;
    const answer = req.body.answer;
    await db.collection('qna').updateOne({ _id: new ObjectId(qnaPostId) }, { $set: { answer } });
    await db.collection('qna').updateOne({ _id: new ObjectId(qnaPostId) }, { $set: { status: '답변완료' } });
    res.json({
      flag: true,
      message: 'Q&N 답변 등록 완료'
    });
  } catch (err) {
    console.error(err);
  }
});
















// 아래부터 진행님 작성 라우터 (테스트 중이셔서 실사용에는 아직 어려울 것 같음)

router.get('/q', (req, res) => {
  try {
    const test = db.collection('shop').insertOne({
      item: '간식',
      price: 5000,
      imgUrl: 'www',
      title: '테스트',
      text: '테스트',
      age: 10,
      size: 'big'
    })
    res.send('ok')
  } catch (err) {
    console.error(err);
  }
})


//  shop C
router.get('/qq', async (req, res) => {
  const result = await db.collection('shop').find({ }).toArray();
  res.send(result);
});

// shop R
router.get('/', (req, res) => {
	res.send('OK');
})

// shop U
// router.post(`/shop`, async (req, res) => {
//   const { postId } = req.body;
//   console.log(postId);
//   const count = await db.collection('shop').updateOne({ _id: new ObjectId(postId) }, {$inc: { view: 1 }});
//   console.log('카운트',count);
//   const result = await db.collection('shop').findOne({ _id: new ObjectId(postId) });
//   console.log(result);
//   res.json({
//     flag: true,
//     data: result,
//   });
// });


router.get(`/qqq`, async (req, res) => {
  // const { 123 } = req.body;
  const abc = '6583a5a6f703dc24018568c1'
  console.log(123);
  const count = await db.collection('shop').updateOne({ _id: new ObjectId('6583a5a6f703dc24018568c1') }, {$inc: { view: 1 }});
  console.log('카운트',count);
  const result = await db.collection('shop').findOne({ _id: new ObjectId('6583a5a6f703dc24018568c1') });
  console.log(result);
  res.json({
    flag: true,
    data: result,
  });
});

// shop D
// router.post('/delete', async (req, res) => {
//   try {
//     const result = await db.collection('shop').deleteOne({
//       _id: new ObjectId(req.body.postId),
//       writer: req.body.username
//     })
//     if (result.deletedCount === 0) {
//       throw new Error('삭제 실패');
//     }
//     res.json({
//       flag: true, 
//       message: '삭제 성공'
//     });
//   } catch (err) {
//     console.error(err);
//     res.status(500).json({
//       flag: false,
//       message: err.message
//     });
//   }
// });

router.post('/delete', async (req, res) => {
  try {
    const result = await db.collection('shop').deleteOne({
      _id: new ObjectId('6583a5a6f703dc24018568c1'),
    })
    if (result.deletedCount === 0) {
      throw new Error('삭제 실패');
    }
    res.json({
      flag: true, 
      message: '삭제 성공'
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      flag: false,
      message: err.message
    });
  }
});


// 장바구니 C


router.get('/w', (req, res) => {
  try {
    const test = db.collection('basket').insertOne({
      userid: 10,
      amount: 2,
      item: 'box'
    })
    res.send('ok')
  } catch (err) {
    console.error(err);
  }
})

router.get("/basket", async (req, res) => {
  const basket = await   basket.find({});
  const productId = basket.map(basket => basket.productId);

  productsInCart = await Products.find()
    .where("productId")
    .in(productId);


  concatCart = basket.map(c => {
    for (let i = 0; i < productsInCart.length; i++) {
      if (productsInCart[i].productId == c.productId) {
        console.log(c.quantity, productsInCart[i]);
        return { quantity: c.quantity, products: productsInCart[i] };
      }
    }
  });

  res.json({
    basket: concatCart
  });
});

// 장바구니 R

router.get('/baskets', (req, res) => {
	res.send('장바구니')
})

// 장바구니 U

router.post("/:productId/basket", async (req, res) => {
  const { productId } = req.params;
  const { quantity } = req.body;

  isBasket = await Basket.find({ productId });
  console.log(isBasket, quantity);
  if (isBasket.length) {
    await Basket.updateOne({ productId }, { $set: { quantity } });
  } else {
    await Basket.create({ productId: productId, quantity: quantity });
  }
  res.send({ result: "success" });
});




// 장바구니 D

router.delete("/:productId/basket", async (req, res) => {
  const { productId } = req.params;

  const isProductsInBasket = await Basket.find({ productId });
  if (isProductsInBasket.length > 0) {
    await Basket.deleteOne({ productId });
  }

  res.send({ result: "success" });
});


// router.patch("/:productId/basket", async (req, res) => {
//   const { productId } = req.params;
//   const { quantity } = req.body;

//   isBasket = await Basket.find({ productId });
//   console.log(isBasket, quantity);
//   if (isBasket.length) {
//     await Basket.updateOne({ productId }, { $set: { quantity } });
//   }

//   res.send({ result: "success" });
// })

router.patch("/basketq", async (req, res) => {
  // const { productId } = req.params;
  // const { quantity } = req.body;
  const productId = 10
  const quantity = 'box'

  isBasket = await db.collection('basket').find({ productId });
  console.log(isBasket, quantity);
  if (isBasket.length) {
    await db.collection(basket).updateOne({ productId }, { $set: { quantity } });
  }

  res.send({ result: "success" });
})

module.exports = router;
