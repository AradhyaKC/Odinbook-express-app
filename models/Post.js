const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const PostSchema= new Schema({
    description:{type:String, maxLength:1000,required:true}, 
    postedOn:{type:String,required:true}, 
    postedBy:{type:mongoose.SchemaTypes.ObjectId,ref:'User',required:true}, 
    comments:[{type:mongoose.SchemaTypes.ObjectId, ref:'Post'}], 
    likes:[{type:mongoose.SchemaTypes.ObjectId, ref:'User'}],
    parentPost:{type:mongoose.SchemaTypes.ObjectId,ref:"Post", required:false}
});

module.exports=mongoose.model('Post',PostSchema);