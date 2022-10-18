require('dotenv').config();
const jwt = require("jsonwebtoken");
const { User } = require("../models");
const { InvalidParamsError } = require('../exceptions/index.exception');


//module.exports = (req, res, next) => {
//  const { token } = req.cookies;
  
//  if (!token) {
//    res.status(401).send({
//      errorMessage: "로그인이 필요합니다.",
//    });
 //   return;
  //};

 // try {
//    const { key } = jwt.verify(token, process.env.SECRETCODE);
 //   User.findByPk(key).then((user) => {
  //    res.locals.user = user;
//      next();
 //   });
 // } catch (err) {//
//    res.status(401).send({
  //    errorMessage: "로그인 후 이용 가능한 기능입니다.",
    //});
//  }
//};

//module.exports = (req, res, next) => {
 // const { accessToken } = req.cookies;
  
 // if (!accessToken) {
  //  res.status(401).send({
   //   errorMessage: "로그인이 필요합니다.",
  //  });
  //  return;
 // };

  //try {
 //   const { userId } = jwt.verify(token, process.env.SECRETCODE);
   // User.findByPk(userId).then((user) => {
     // res.locals.user = user;
//      next();
 //   });
 // } catch (err) {
 //   res.status(401).send({
  //    errorMessage: "로그인 후 이용 가능한 기능입니다.",
  //  });
 // }
//};
module.exports = async (req, res, next) => {
  try {
    const accessToken = req.cookies.accessToken;
    const refreshToken = req.cookies.refreshToken;

    if (!accessToken) {
      throw new InvalidParamsError('다시 로그인 해주세요.');
    }




    if (!accessToken || !refreshToken) {
      throw new InvalidParamsError('로그인 후 사용해주세요.');
    }

    let accessVerified = null;
    let refreshVerified = null;

    try {
      accessVerified = jwt.verify(accessToken, process.env.SECRET_KEY);
    } catch (error) {
      accessVerified = null;
    }
    try {
      refreshVerified = jwt.verify(refreshToken, process.env.SECRET_KEY);
    } catch (error) {
      refreshVerified = null;
    }

    try {
      // 1.access토큰, refresh토큰 모두 사용 불가
      if (!accessVerified && !refreshVerified) {
        throw new InvalidParamsError('로그인 기한이 만료되었습니다.');
      }

      // 2.access토큰은 만료되었지만 refresh토큰이 존재한다면 accessToken 발급
      if (!accessVerified && refreshVerified) {
        const existUser = await User.findOne({
          where: { refreshToken: refreshToken },
        });

        if (!existUser) {
          throw new InvalidParamsError('로그인 기한이 만료되었습니다.');
        }

        // accessToken 발급
        const userId = existUser.userId; //옵셔널 체이닝

        const newAccessToken = jwt.sign({ userId }, process.env.SECRET_KEY, {
          expiresIn: '1d',
        });
        console.log(newAccessToken, 'newAccessToken 확인');
        res.cookies('accesToken', newAccessToken)

        return res.status(201).json({
          accessToken: newAccessToken,
          refreshToken: refreshToken,
          msg: 'acceess 토큰이 재발급 되었습니다.',
        });
      }

      // 3.access토큰은 있지만, refresh토큰 사용 불가하다면 refreshToken 발급
      if (accessVerified && !refreshVerified) {
        const { userId } = accessVerified;

        const existUser = await User.findOne({ where: { userId } });
        if (!existUser) {
          throw new InvalidParamsError(401, '로그인 기한이 만료되었습니다.');
        }
        // refreshToken 발급
        const newRefreshToken = jwt.sign({ userId }, process.env.SECRET_KEY, {
          expiresIn: '21d',
        });
        console.log(newRefreshToken, 'newRefreshToken 확인');

        await User.update(
          { refreshToken: newRefreshToken },
          { where: { userId } }
        );
        res.cookies('refreshToken', newRefreshToken);

        return res.status(201).json({
          accessToken: accessToken,
          refreshToken: newRefreshToken,
          msg: 'refresh 토큰이 재발급 되었습니다.',
        });
      }

      if (accessVerified && refreshVerified) {
        const { userId } = accessVerified;
        User.findOne({
          where: { userId },
          attributes: ['userId', 'username'],
        }).then((user) => {
          
          res.locals.user = user;
          next();
        });
      }
    } catch (error) {
      next(error);
    }
  } catch (error) {
    next(error);
  }
};