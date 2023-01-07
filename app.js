var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var mongoose = require('mongoose');
var passport = require('passport');
var session =require('express-session');
var LocalStrategy= require('passport-local').Strategy;
var GoogleStrategy = require('passport-google-oauth20').Strategy;
var GoogleTokenStrategy = require('passport-google-token').Strategy;
const User = require('./models/User');
const bcrypt = require('bcrypt');
require('dotenv').config();

var app = express();
module.exports = app;

var mongooseConnectionString = process.env.MONGOOSE_CONNECTION_STRING;
mongoose.connect(mongooseConnectionString, {useNewUrlParser:true, useUnifiedTopology:true});

const db = mongoose.connection;
db.on('error',()=>{
  console.error('mongodb connection error');
});


var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var postsRouter = require('./routes/posts');
var cors = require('cors');


// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use(cors());
// app.options('*',cors());


passport.use(
  new LocalStrategy({usernameField:'email'},async (email, password, done) => {
    User.findOne({ email: email }, async(err, user) => {
      if (err) { 
        return done(err);
      }
      if (!user) {
        return done(null, false, { message: "Incorrect email address" });
      }

      if (!bcrypt.compareSync(password,user.password)) {
        return done(null, false, { message: "Incorrect password" });
      }
      return done(null, user);
    });
  })
);


passport.use(new GoogleTokenStrategy({
    clientID:process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
  },
  function(accessToken, refreshToken, profile, done) {
    User.findOrCreate(
      {
        googleId: profile.id,
        first_name:profile._json.name,
        last_name:profile._json.family_name,
        email:profile._json.email,
      }, 
      function(err, user)
      {
        return cb(err, user);
      }
    );
  }
));

passport.serializeUser(function(user, done) {
  done(null, user.id);
});

passport.deserializeUser(function(id, done) {
  User.findById(id, function(err, user) {
    done(err, user);
  });
});

app.use(session({ secret: "cats", resave: false, saveUninitialized: true }));
app.use(passport.initialize());
app.use(passport.session());



app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/users/:userId/posts',postsRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});



