const User=require('../models/User');
const express = require('express');
const {body,validationResult}=require('express-validator');
var router = express.Router();
const passport = require('passport');
const bcrypt = require('bcrypt');
const jwt_decode = require('jwt-decode');
const multer =require('multer');
const fs=require('fs');
const async = require('async');
const path = require('path');
const postsRouter = require('./posts');
const {GridFsStorage} = require('multer-gridfs-storage');
const crypto = require('crypto');
var mongoose = require('mongoose');

/* GET users listing. */
router.get('/', async function(req, res, next) {
  try{
    var randomnUsers = await User.find({},{password:0,profilePicUrl:0}).limit(10);
    // console.log(randomnUsers);
    return res.status(200).json({message:'success',users:randomnUsers});
  }catch(err){
    console.error(err);
    return res.status(500).json({message:'error',error:err});
  }
});
router.get('/search/:searchQuery',
async(req,res)=>{
  try{
    req.params.searchQuery = req.params.searchQuery.trimStart().trimEnd();
    console.log('value of seacrhQ is ' +req.params.searchQuery);
    if( req.params.searchQuery==undefined || req.params.searchQuery==undefined) throw 'seacrhQuesry was not assign a value';
    
    var terms = req.params.searchQuery.split(' ');
    let seacrhQ1=terms[0];
    let seacrhQ2=undefined;
    if(terms.length>1) seacrhQ2=terms[1];

    var orRegex ={
      '$or':[
        {'first_name':{'$regex':'^'+seacrhQ1,$options:"$i"}},{'last_name':{'$regex':'^'+seacrhQ1,$options:"$i"}},
        ...(()=>{
          if(seacrhQ2!=undefined){
            return [{'first_name':{'$regex':'^'+seacrhQ2,$options:"$i"}},{'last_name':{'$regex':'^'+seacrhQ2,$options:"$i"}}];
          }else{
            return [];
          }
        })(),
      ]
    };

    var randomUsers = await User.find(orRegex,{password:0,profilePicUrl:0}).limit(10);

    return res.status(200).json({message:'success',users:randomUsers});
  }catch(err){
    console.error(err);
    return res.status(500).json({message:'error',error:err});
  }
});

router.post('/',[
  body('first_name','First Name cannot be empty').trim().isLength({min:1,max:20}).escape(),
  body('last_name','Last Name cannot be empty').trim().isLength({min:1,max:20}).escape(),
  body('email','Email is required').trim().isLength({min:1,max:20}).escape(),
  body('email',"Email entry should be a valid email address").isEmail(),
  body('password','should not be emplty and within 3-20 letters/numbers').trim().isLength({min:2,max:20}).escape(),
  // body('email','there already exist an account with this email').custom(async (emailValue)=>{
  //   return User.find({email:emailValue}).exec(function(err,result){
  //     if(err) return next(err);
  //     console.log(result.length==0);
  //     return (result.length==0);
  //   });
  // }),
  async function(req,res,next){
    var {first_name,last_name,email,password} = req.body;
    const errors = validationResult(req);

    await bcrypt.hash(password,3,function(err,hash){
      password=hash;
    });

    await User.find({email:email}).exec(function(err,result){
      if(err) return next(err);

      var newArray;
      newArray =errors.array();
      if(result.length!=0) {
        newArray.push({param:'email',msg:'there already exists an account with this email address',location:'body'});
      }

      if(newArray.length!=0){
        return res.status(100).json({errors:newArray});
      }

      let joinDate=new Date(Date.now());
      joinDate=joinDate.toDateString();
      joinDate=joinDate.slice(0,16);
      let description = 'Hello , I am using OdinBook , lorem ipsum detour something ';
      var newUser= new User({first_name,last_name,email,password,joinDate,description});
      newUser.save((err)=>{
        if(err) return next(err);
      });
      return res.status(200).json({errors:undefined});
    });
  }
]);

router.post('/LogIn',function(req,res,next){
  passport.authenticate('local',(error,user,info)=>{
    if(error) return res.status(500).json({message:error ||'something happenned (failed to authenticate user)'});
    if(!user) return res.status(500).json({message:info.message});
    user['password'] =undefined;
    return res.status(200).json({message:'success',user});
  })(req,res,next);
});

// var storage= multer.diskStorage({destination: 'uploads/' ,fileFilter: (req, file, cb) => {
//   if (
//     file.mimetype == 'image/png' ||
//     file.mimetype == 'image/jpeg' ||
//     file.mimetype == 'image/jpg'
//   ) {
//     cb(null, true);
//   } else {
//     cb(null, false);
//     const err = new Error('Only .jpg .jpeg .png images are supported!');
//     err.name = 'ExtensionError';
//     return cb(err);
//   }
// },
// filename:function(req,file,cb){
//   let fileType= file.mimetype;
//   fileType = fileType.slice(6);
//   const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//   // console.log(file.fieldname + '-' + uniqueSuffix+'.'+fileType);
//   return cb(null, file.fieldname + '-' + uniqueSuffix+'.'+fileType);
// }
// });

// const upload = multer({storage:storage}).single('profilePicUrl');

const storage = new GridFsStorage({
  url: process.env.MONGOOSE_CONNECTION_STRING,
  file: (req, file) => {
      return new Promise((resolve, reject) => {
          crypto.randomBytes(16, (err, buf) => {
              if (err) {
                  return reject(err);
              }
              const filename = buf.toString('hex') + path.extname(file.originalname);
              const fileInfo = {
                  filename: filename,
                  bucketName: 'uploads'
              };
              resolve(fileInfo);
          });
      });
  }
});

const upload = multer({ storage }).single('profilePicUrl');

router.patch('/:userId',(req, res,next) =>
  {
    upload(req, res, function (err)
    {
      if (err instanceof multer.MulterError) {
        console.log(err);
        res.status(501).json({error: { msg: `multer uploading error: ${err.message}` },}).end();
        return;
      } else if (err)
      {
        if (err.name == 'ExtensionError')
        {
          res.status(413).json({ message:'error',error: { msg: `${err.message}` } }).end();
        } else
        {
          res.status(500).json({  message:'error',error: { msg: `unknown uploading error: ${err.message}` } }).end();
        }
        return;
      }
      next();
    });
  },
  (req,res)=>{
    // console.log(req.params.userId);
    // console.log(req.body);
    User.updateOne({_id:req.params.userId},{'$set':{
      first_name:req.body.first_name, last_name:req.body.last_name, description:req.body.description,profilePicUrl:req.file.filename,
    }},(err, result)=>{
      if(err) return res.status(400).json({message:'error',errors:['failed to update or find existing user']});
      User.findById(req.params.userId,(err,user)=>{
        if(err) return res.status(500).json({message:'error',errors:err});
        user.password=undefined;
        // console.log(app.get('SERVER_DOMAIN')+'/users/'+req.params.userId+'/profileImage');
        // newUser.profilePicUrl.name1= app.get('SERVER_DOMAIN')+'/'+req.params.userId+'/profileImage';
        // console.log(newUser);
        return res.status(200).json({message:'success',user:user});
      });
    });

    // console.log(fs.readFileSync('uploads/'+req.file.filename));
  }
);

router.get('/auth/google',
  passport.authenticate('google',{scope:['email','profile']})
);

router.get('/auth/google/callback',
  passport.authenticate('google'),
  function(req,res,next){
    console.log(req.user);
    return res.status(201).json({
      message:'success',
      user:{
        id:req.user._id, first_name:req.user.first_name, last_name:req.user.last_name,email:req.user.email,
        googleId:req.user.googleId,password:undefined
      }
    });
  }
);


router.post('/auth/google/token',function(req,res,next){
  var decoded = jwt_decode(req.body.token);
  User.findOrCreate({
    googleId:decoded.sub,
    first_name:decoded.given_name,
    last_name:decoded.family_name,
    email:decoded.email,
  },(err,user)=>{
    if(err) return next('failed in finding or creating google account');
    return res.status(201).json({
      message:'success', user:user
    });
  });
});

router.get('/:userId',async function(req,res){
  try{
    var user = await User.find({_id:req.params.userId},{password:0,profilePicUrl:0});
    user=user[0];
    // console.log(user);
    return res.status(200).json({message:'success',user:user});
  }catch(err){
    return res.status(200).json({message:'error',error:err});  
  }
});

// router.get('/:userId/profileImage',(req,res)=>{
//   async.parallel([
//     (callback)=>{
//       User.find({_id:req.params.userId},callback);
//     }
//   ],(err,results)=>{
//     if(err) return res.status(500).json({message:'error',errors:err});
//     // console.log(results[0]);
//     var picture=results[0][0]['profilePicUrl'];
//     // let imageFormat = results[0][0]['profilePicUrl']['contentType'];
//     // imageFormat = imageFormat.slice(6);
//     // const base64String= btoa(String.fromCharCode(...new Uint8Array(response.user['profilePicUrl'].data.data)));
//     // response.user['profilePicUrl']=`data:${response.user['profilePicUrl'].contentType};base64,${base64String}`;
//     if(picture.name!='' && picture.name!=undefined){
//       // return res.sendFile(path.join(__dirname,'../upload s/'+picture['name']+'.'+imageFormat));
//       return res.sendFile(path.join(__dirname,'../uploads/'+picture['name']));
//     }else{ 
//       return res.sendFile(path.join(__dirname ,'../User.png'));
//     }
//   });
// });

const url = process.env.MONGOOSE_CONNECTION_STRING;
const connect = mongoose.createConnection(url, { useNewUrlParser: true, useUnifiedTopology: true });
let gfs;

connect.once('open', () => {
// initialize stream
  gfs = new mongoose.mongo.GridFSBucket(connect.db, {
    bucketName: "uploads"
  });
});

router.get('/:userId/profileImage',async(req,res)=>{
  try{
    var user = await User.findOne({_id:req.params.userId},{password:0});
    if(user.profilePicUrl!=undefined && user.profilePicUrl!=''){
      gfs.find({filename:user.profilePicUrl}).toArray((err,files)=>{
        if(!files[0]||files.length==0) return res.status(200).json({message:'error',error:'no such file is available'});
        gfs.openDownloadStreamByName(user.profilePicUrl).pipe(res);
      });
    }else{
      return res.sendFile(path.join(__dirname ,'../User.png'));
    }
  }catch(err){
    console.log(err);
    return res.status(200).json({message:'error',error:err}); 
  }
});



router.put('/:userId/friendRequests',async(req,res)=>{
  try{
    var user = await User.find({_id:req.params.userId});
    user=user[0];
    console.log(user);
    if(user.friendRequests.includes(req.body.requestedBy))
      throw 'you have already sent a friend request to this person';
    else{
      user.friendRequests.push(req.body.requestedBy);
    }
    await user.save();
    return res.status(200).json({message:'success',friendRequests:user.friendRequests});  
  }catch(err){
    console.log(err);
    return res.status(200).json({message:'error',error:err});  
  }
});
router.get('/:userId/friends',async(req,res)=>{
  try{
    var user = await User.findOne({_id:req.params.userId},{password:0,profilePicUrl:0});
    var userFriends =await Promise.all(user.friends.map(async(friendId)=>{
      return await User.findOne({_id:friendId},{password:0,profilePicUrl:0});
    }));
    return res.status(200).json({message:'success',friends:userFriends});
  }catch(err){
    console.log(err);
    return res.status(200).json({message:'error',error:err});  
  }
});

router.delete('/:userId/friendRequests/:friendRequestId',async(req,res)=>{
  try{
    var user = await User.find({_id:req.params.userId},{password:0,profilePicUrl:0});
    user = user[0];

    if(user.friendRequests.includes(req.params.friendRequestId)){
      var index = user.friendRequests.findIndex(friendReqId=>friendReqId==req.params.friendRequestId);
      console.assert(index>=0,'could not find friendReq from the friendReqList');
      user.friendRequests.splice(index,1)
    }else{
      return res.status(400).json({message:'error',error:'there does not exist a friendReq with the friendReqId provided'});
    }
    await user.save();
    return res.status(200).json({message:'success',user:user});
  }catch(err){
    console.log(err);
    return res.status(200).json({message:'error',error:err});  
  }
});

router.post('/:userId/friends/:friendId',async(req,res)=>{
  try{
    // console.log(req.body.friend1+'  2: '+req.body.friend2);
    var [friend1,friend2] = await Promise.all([
      User.find({_id:req.params.userId},{password:0,profilePicUrl:0}),
      User.find({_id:req.params.friendId},{password:0,profilePicUrl:0})
    ]);
    
    friend1=friend1[0];
    friend2=friend2[0];

    if(friend1.friends.length!=0 && friend1.friends.includes(friend2._id)){
      return res.status(200).json({message:'error',error:'the pair are alreaady friends'});
    }
    if(friend2.friends.length!=0 && friend2.friends.includes(friend1._id)){
      return res.status(200).json({message:'error',error:'the pair are alreaady friends'});
    }

    if(friend1.friendRequests.includes(friend2._id)){
      var index =friend1.friendRequests.indexOf(friend2._id);
      console.assert(index>=0,'could not find friend ');
      friend1.friendRequests.splice(index,1);
    }
    if(friend2.friendRequests.includes(friend1._id)){
      var index =friend1.friendRequests.indexOf(friend2._id);
      console.assert(index>=0,'could not find friend ');
      friend1.friendRequests.splice(index,1);
    }

    friend1.friends.push(friend2._id);
    friend2.friends.push(friend1._id);
    console.log(friend1);

    await Promise.all([friend1.save(),friend2.save()]);
    return res.status(200).json({message:'success',friends:[friend1,friend2]});

  }catch(err){
    console.log(err);
    return res.status(200).json({message:'error',error:err});  
  }
});

router.delete('/:userId/friends/:friendId',async(req,res)=>{
  try{
    var friend1 = await User.find({_id:req.params.userId},{password:0,profilePicUrl:0});
    if(req.params.friendId==undefined ||req.params.friendId==''){
      throw 'the freind to remove has not been specified';
    }
    var friend2= await User.find({_id:req.params.friendId},{password:0,profilePicUrl:0});

    if(!friend1.friends.includes(req.params.friendId)){
      throw 'not possible to remove user friend as they are not friends';
    }else{
      var index = friend1.friends.findIndex(friendId=>friendId==req.params.friendId);
      console.assert(index>=0,'was able to find friend mong friendList');
      friend1.friends.splice(index,1);
    }

    if(!friend2.friends.includes(req.params.userId)){
      throw 'not possible to remove user friend as they are not friends';
    }else{
      var index = friend2.friends.findIndex(friendId=>friendId==req.params.userId);
      console.assert(index>=0,'was able to find friend mong friendList');
      friend1.friends.splice(index,1);
    }

    await Promise.all([friend1.save(),friends2.save()]);
    return res.status(200).json({message:'success',friends:[friend1,friend2]});
  }catch(err){
    console.log(err);
    return res.status(200).json({message:'error',error:err});  
  }
});

// router.use('/:userId/posts',postsRouter);
// router.post('/:userId/posts/',
// // body('postedBy', 'the id of the user posting was invalid or the user could npt be found').custom(async (postedByUserId)=>{
// //   var user = await User.findById(postedByUserId);
// //   if(!user) return false;
// //   else return true
// // }), 
// (req,res)=>{
//   console.log(req.params.userId);
//   return res.json({tempObject:'hello'});
// });

module.exports = router;
