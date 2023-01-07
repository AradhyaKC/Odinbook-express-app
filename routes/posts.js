const User=require('../models/User');
const Post = require('../models/Post');
const express = require('express');
const {body,validationResult}=require('express-validator');
var router = express.Router({mergeParams:true});
// const multer = require('multer');
// const upload = multer().none();
const async = require('async');

router.post('/',
body('description').escape(),
(req,res)=>{
    async.parallel([
        (callback)=>{ //0
           User.countDocuments({_id:req.body.postedBy},callback)
        },
    ], 
    (err,results)=>{
        if(err){
            console.log(err)
            return res.status(500);
        }
        if(results[0]==1){
            var errors = validationResult(req);
            if(errors.errors.length!=0){
                return res.status(400).json({message:'error',errors:errors});
            }
            var {description,postedBy,postedOn,parentPost} = req.body;
            var newPost;
            if(parentPost!=undefined){
                newPost=new Post({description,postedOn,postedBy,parentPost});
                // console.log(newPost)
            }else{
                newPost =new Post({description,postedOn,postedBy});
            }
            //refactor to use async lib ? 
            newPost.save((err,post)=>{
                Post.findOne({_id:post._id}).populate({path:'postedBy',model:'User',select:{_id:1,first_name:1,last_name:1}}).exec((err,result)=>{
                    if(err) return res.status(500).json({message:'error', error:err});
                    if(parentPost!=undefined) {
                        Post.findOne({_id:parentPost}).exec((err,post)=>{
                            if(err) return res.status(500).json({message:'error', error:err});
                            post.comments.push(newPost._id);
                            post.save((err,post)=>{
                                if(err) return res.status(500).json({message:'error', error:err});
                                return res.status(200).json({message:'success',post:result});
                            });
                        }); 
                    }else{
                        return res.status(200).json({message:'success',post:result});
                    }
                });

                // if(err) return res.status(500).json({message:'error',errors:err});
                // return res.json({message:'success',post:post});
            });
        }
    }
    );
});

router.get('/',(req,res)=>{
    Post.find({postedBy:req.params.userId,parentPost:undefined}).populate({path:'postedBy',model:'User',select:{_id:1,first_name:1,last_name:1}}).exec((err,results)=>{
        if(err){
            console.log(err);
            return res.status(500).json({message:'error',errors:err});
        } 
        // console.log(results);
        return res.status(200).json({message:'success',posts:results});
    });
    return;
});

router.put('/:postId/likes',(req,res)=>{
    Post.findOne({_id:req.params.postId}).populate({path:'postedBy',model:'User',select:{_id:1,first_name:1,last_name:1}}).exec((err,results)=>{
        var post = results;
        // console.log(post);
        if(post.likes.includes(req.body.likedBy)){
            let index =post.likes.indexOf(req.body.likedBy);
            post.likes.splice(index,1);
        }else{
            post.likes.push(req.body.likedBy);
        }
        post.save((err,result)=>{
            if(err) return res.status(500).json({message:'error', error:err});
            // post.populate({path:'postedBy',model:'User',select:{first_name:1,last_name:1}})
            return res.status(200).json({message:'success',post:result});
        });
    });
});

router.delete('/:postId',async(req,res)=>{
    try{
        var openList=[];
        var post = await Post.findOne({_id:req.params.postId});
        if(post.postedBy._id!=req.body.deletedBy){
            return res.status(403).json({message:'error',error:'the delete can only be made by the poster'});
        }
        async function addToOpenListRecursively(postId){
            var thisPost = await Post.findOne({_id:postId});

            var promiseAll = await Promise.all(thisPost.comments.map(async (childCommentId)=>{
                await addToOpenListRecursively(childCommentId);
            }));
            openList.push(thisPost._id);
        }
        // console.log(post);
        if(post.parentPost!=undefined){
            var parentPost =await Post.findOne({_id:post.parentPost});
            let index =parentPost.comments.indexOf(req.params.postId);
            parentPost.comments.splice(index,1);
            parentPost.save();
        }
        await addToOpenListRecursively(req.params.postId);
        var deleteAll = await Promise.all(openList.map(async(commentId)=>{
            await Post.deleteOne({_id:commentId});
        }));

        return res.status(200).json({message:'success'});
    }catch(error){
        console.error(error);
        return res.status(500).json({message:'error',error:error});
    }
});

router.get('/:postId/comments', async (req,res)=>{
    const populateRecursively=async(commentId)=>{
        try{
            var thisComment= await Post.findOne({_id:commentId},'_id description postedBy postedOn comments parentPost').
            populate({path:'postedBy',select:{_id:1,first_name:1,last_name:1}});
            // console.log(thisComment);
            if(thisComment.comments.length==0){
                thisComment.comments=[];
                return thisComment;
            }
            else{
                thisComment.comments=await Promise.all(thisComment.comments.map(async(elementId)=>{
                    return await populateRecursively(elementId);
                }));
                return thisComment;
            }    
        }catch(err){
            console.error('error ' + err);
        }
    }
    
    var returnComments = await populateRecursively(req.params.postId);
    returnComments=returnComments.comments;
    return res.status(200).json({message:'success',comments:returnComments});
});

module.exports= router;