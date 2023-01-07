var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/', async function(req, res, next) {  
  res.render('index', { title:"Express"});
});

router.post('/', async function(req,res,next){
  // var reqData = req;
  // if(reqData==undefined) return res.status(500).json('failed');
  console.log(req.body);
  res.json({data:9});
});

module.exports = router; 
