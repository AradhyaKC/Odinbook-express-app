const mongoose = require('mongoose');
const findOrCreate = require('mongoose-findorcreate');
const Schema = mongoose.Schema;

const UserSchema =new Schema({
    first_name:{type:String,required:true},
    last_name:{type:String,required:true},
    email:{type:String,required:true,unique:true},
    password:{type:String, required:false, minLength:3, maxLength:100},
    googleId:{type:String, required:false},
    joinDate:{type:String,required:false,},
    description:{type:String,required:false,minLenght:3},
    profilePicUrl:{type:String,required:false},
    friendRequests:[{type:mongoose.SchemaTypes.ObjectId, ref:'User',required:'false',default:[]}],
    friends:[{type:mongoose.SchemaTypes.ObjectId, ref:'User',required:'false',default:[]}]
});

UserSchema.plugin(findOrCreate);

module.exports = mongoose.model('User',UserSchema);