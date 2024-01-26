const express = require("express");
const mysql = require('mysql');
const bodyParser =require("body-parser");
const cookieParser  = require('cookie-parser');
const crypto = require("crypto");
const session = require('express-session');
const connection  = require('./db');
const cors = require('cors');
const Razorpay=require("razorpay");
const alert = require("alert");
const dotenv=require("dotenv");
const async = require('async');
const date = require('date-and-time');
const { log } = require("console");
const app = express();

dotenv.config();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.set('view engine','ejs');
app.use(express.static('views'));
app.use(cors());
app.use(express.json());
app.use(
    bodyParser.urlencoded({
        extended:false
    })
);
app.use(bodyParser.json());
app.use(session({
	secret: 'secret',
	resave: true,
	cookie: { maxAge: 86400000 },
	saveUninitialized: true
}));

var sessions,details;
// Login  and  logout
app.post('/fstudentlogin', (req,res)=> {
	let username = req.body.username;
	let password = req.body.password;
	if (username && password) {
		async.parallel([
			()=>{
				connection.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password],(err,results)=>{
					if (err) throw err;
					if (results.length > 0) {
						req.session.loggedin = true;
						sessions=req.session;
						sessions.name=req.body.username;
						console.log(sessions);
						// res.send(`<h1 style="color:green;">You are logged in...</h1>`);
					}
					else {
						// res.send(`<h1 style="color:red;">Incorrect Username and/or Password!</h1>`);
						alert("Incorrect Username and/or Password!");
						// errmessage="Incorrect Username and/or Password!";
						res.redirect("/finance.html");
					}			
				})
			},
			()=>{
				connection.query('SELECT * FROM rgukt.students where id in (select userid from rgukt.users where username = ?);',[username],(err,results)=>{
					// results=JSON.stringify(results);
					details=results[0];
					console.log(results);
					res.render('finance',{details:details});
				})
			}
		])
		
    }
});	
app.get('/logout', function(req,res) {
	req.session.destroy();
	sessions=undefined;
	details=undefined;
	alert("You are successfully loggedout");
	console.log("You are successfully loggedout");
  	res.redirect('/');
});
app.get('/',(req,res)=>{
    if(!sessions){
		res.sendFile(__dirname+'/public/home.html');
	}else{
		res.render('home');
	}
})

// Finance
app.get('/finance',(req,res)=>{
	if(!sessions){
		res.sendFile(__dirname+'/public/finance.html');
	}else{
		res.render('finance',{details:details});
	}
})
//Razorpay
const instance=new Razorpay({
    key_id:process.env.KEY_ID,
    key_secret:process.env.KEY_SECRET
});
//Routes
app.get("/pay",(req,res)=>{
    res.render('pay',{key:process.env.KEY_ID});
}); 
var data;
app.post('/details',(req,res)=>{
	data = req.body;
}) 
app.post("/api/payment/order",(req,res)=>{
    params=req.body;
    instance.orders
        .create(params)
        .then((data)=>{
            res.send({sub:data,status:"success"});
        })
        .catch((error)=>{
            res.send({sub:error,status:"failed"});
        });
});
app.post("/api/payment/verify",(req,res)=>{
    body=req.body.razorpay_order_id + "|" + req.body.razorpay_payment_id;
	console.log(req.body.razorpay_payment_id);
    var expectedSignature=crypto
        .createHmac("sha256",process.env.KEY_SECRET)
        .update(body.toString())
        .digest("hex");
    console.log("sig" + req.body.razorpay_signature);
    console.log("sig" + expectedSignature);
    var response={status:"failure"};
    if(expectedSignature === req.body.razorpay_signature){
		response={status:"success"};
		var query=`INSERT INTO finance (id,name,class,date,phone,type,amount,trans_id) VALUES(?,?,?,?,?,?,?,?)`;
		connection.query(query,[data.id,data.name,data.class,data.date,data.phone,data.type,data.amount,req.body.razorpay_payment_id]);
		data.trans_id=req.body.razorpay_payment_id;
		console.log("Successfully paid");
	}  
    res.send(response);
});
app.get('/receipt',(req,res)=>{
	res.render('receipt',{data:data});
})
// Change student password
app.post('/changepassword',(req,res)=>{
	var username = sessions.name;
	var oldPassword = req.body.oldpassword;
	var newPassword = req.body.newpassword;
	connection.query('select password from users where username = ?',[username],(err,results)=>{
		if(err) throw err;
		else{
			if(JSON.stringify(oldPassword) === JSON.stringify(results[0].password)){
				connection.query('UPDATE users SET password = ? WHERE username = ?',[newPassword,username],(err)=>{
					if(err) throw err;
					else {
						alert("Password changed successfully");
						res.redirect("back");
					}
				});
			}else{
				console.log("not equal");
			}
		}
	})
})
// check student history(finance)
app.get('/fcheckhistory',(req,res)=>{
	connection.query('select * from rgukt.finance where id in(select id from rgukt.users where username = ?)',[sessions.name],(err,results)=>{
		if(err) throw err;
		if(results.length > 0){
			res.render('fcheckhistory',{data:results});
		}else {
			console.log("no data found!");
			alert("Please do any transaction to show details");
			res.redirect('back');
		}
	})
})
// Finance admin
app.get('/fadmin',(req,res)=>{
	connection.query('SELECT * FROM rgukt.finance order by date DESC limit 5;',(err,results)=>{
		if(err) throw err;
		else res.render('fadmin',{data:results});
	})
}) 
app.get('/fadminlogin',(req,res)=>{
	connection.query('SELECT * FROM rgukt.finance order by date DESC limit 5;',(err,results)=>{
		if(err) throw err;
		else res.render('fadmin',{data:results});
		console.log("finance admin logged in");
	})
})
app.post("/fadminlogin",(req,res)=>{
	let username = req.body.username;
	let password = req.body.password;
	if(username==='admin' && password==='admin@123'){
		connection.query('SELECT * FROM rgukt.finance order by date DESC limit 5;',(err,results)=>{
			if(err) throw err;
			if (results.length > 0) {
				req.session.loggedin = true;
				sessions=req.session;
				sessions.name=req.body.username;
				console.log(sessions);
				res.render('fadmin',{data:results});
				console.log("finance admin logged in");
			} 
		})
	}
})
app.get("/fstudentdetails",(req,res)=>{
	connection.query('select * from rgukt.students',(err,results)=>{
		if(err) throw err;
		res.render('fstudentdetails',{students:results});
	})
})
app.get('/addstudent',(req,res)=>{
	res.render('addstudent');
})
app.post('/addstudent',(req,res)=>{
	let data = req.body;
	var query=`INSERT INTO students (id,name,class,father_name,mother_name,phone,aadhaar,scholarship_id,address) VALUES(?,?,?,?,?,?,?,?,?)`;
	connection.query(query,[data.id,data.name,data.class,data.father_name,data.mother_name,data.phone,data.aadhaar,data.scholarship_id,data.address]);
	console.log("Student added succeessfully");
	alert("Student added successfully");
	res.redirect('back');
})
app.post('/removestudent',(req,res)=>{
	let id = req.body.id;
	connection.query('delete from students where id = ?',[id],(err,results)=>{
		if(err) throw err;
		alert('Student deleted');
		console.log("student deleted");
		res.redirect('back');
	})
})
app.post('/fsearchhistorybydate',(req,res)=>{
	let info = req.body;
	console.log(info.from,info.to);
	connection.query('select * from rgukt.finance where date between ? and ? order by date desc',[info.from,info.to],(err,results)=>{
		if(err) throw err;
		if(results.length > 0){
			res.render('fsearchhistory',{results:results});
		}else{
			alert('No data found');
			console.log('No data found');
			res.redirect('/fadmin');
		}
	})
})
app.post('/fsearchhistorybyid',(req,res)=>{
	let info = req.body;
	connection.query('select * from rgukt.finance where id = ? order by date desc',[info.id],(err,results)=>{
		if(err) throw err;
		if(results.length > 0){
			res.render('fsearchhistory',{results:results});
		}else{
			alert('No data found');
			console.log('No data found');
			res.redirect('/fadmin');
		}
	})
})

// Outpass
app.get('/outpass',(req,res)=>{
	if(!sessions){
		res.sendFile(__dirname+'/public/outpass.html');
	}else{
		res.render('outpass',{details:details});
	}
})
app.post('/ostudentlogin', (req,res)=> {
	let username = req.body.username;
	let password = req.body.password;
	if (username && password) {
		async.parallel([
			()=>{
				connection.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password],(err,results)=>{
					if (err) throw err;
					if (results.length > 0) {
						req.session.loggedin = true;
						sessions=req.session;
						sessions.name=req.body.username;
						console.log(sessions);
						// res.send(`<h1 style="color:green;">You are logged in...</h1>`);
					}
					else {
						// res.send(`<h1 style="color:red;">Incorrect Username and/or Password!</h1>`);
						alert("Incorrect Username and/or Password!");
						// errmessage="Incorrect Username and/or Password!";
						res.redirect("/outpass.html");
					}			
				})
			},
			()=>{
				connection.query('SELECT * FROM rgukt.students where id in (select userid from rgukt.users where username = ?);',[username],(err,results)=>{
					// results=JSON.stringify(results);
					details=results[0];
					console.log(results);
					res.render('outpass',{details:details});
				})
			}
		])
		
    }
});	
app.get('/orequestform',(req,res)=>{
	res.render('orequestform');
})
app.post('/orequestform',(req,res)=>{
	let data = req.body;
	console.log(data);
	connection.query('INSERT INTO outpass (id,name,type,ldatetime,rdatetime,address,reason,phone,status) VALUES(?,?,?,?,?,?,?,?,"pending")',[data.id,data.name,data.type,data.from,data.to,data.address,data.reason,data.phone]);
	alert('Request submitted successfully');
	console.log('Request submitted successfully');
	res.redirect('/orequestform');
})
app.get('/ocheckhistory',(req,res)=>{
	connection.query('select * from rgukt.outpass where id in(select id from users where username = ?)',[sessions.name],(err,results)=>{
		if(err) throw err;
		if(results.length > 0){
			console.log(results);
			res.render('ocheckhistory',{data:results});
		}else {
			console.log("no data found!");
			alert("No history to show");
			res.redirect('back');
		}
	})
})
// Outpass Warden
app.post("/owardenlogin",(req,res)=>{
	let username = req.body.username;
	let password = req.body.password;
	if(username==='warden' && password==='warden@123'){
		connection.query('SELECT * FROM rgukt.outpass where status = "pending"',(err,results)=>{
			if(err) throw err;
			if (results.length > 0) {
				req.session.loggedin = true;
				sessions=req.session;
				sessions.name=req.body.username;
				console.log(sessions);
				res.render('owarden',{data:results});
			}else{
				res.render('owarden',{data:results});
				console.log("warden  logged in");
			}
		})
	}
})
app.get('/owarden',(req,res)=>{
	connection.query('SELECT * FROM rgukt.outpass where status = "pending"',(err,results)=>{
		if(err) throw err;
		res.render('owarden',{data:results});
	})
})
app.get("/ostudentdetails",(req,res)=>{
	connection.query('select * from rgukt.students',(err,results)=>{
		if(err) throw err;
		res.render('ostudentdetails',{students:results});
	})
})
app.post("/orequest",(req,res)=>{
	let data = req.body;
	connection.query('select * from outpass where id = ?',[data.id],(err,results)=>{
		if(err) throw err;
		if(results.length > 0){
			res.render('orequest',{data:results[0]});
		}
	})
})
app.get('/oaccepts',(req,res)=>{
	connection.query('select * from rgukt.outpass where status = "accepted"',(err,results)=>{
		if(err) throw err;
		if(results.length > 0){
			res.render('oaccepts',{data:results});
		}
	})
})
app.get('/orejects',(req,res)=>{
	connection.query('select * from rgukt.outpass where status = "rejected"',(err,results)=>{
		if(err) throw err;
		if(results.length > 0){
			res.render('orejects',{data:results});
		}
	})
})
app.post('/accept',(req,res)=>{
	let data = req.body;
	connection.query('update outpass set status = "accepted" where id = ?',[data.id]);
	alert("Accepted");
	console.log("Accepted");
	res.redirect('/owarden');
})
app.post('/reject',(req,res)=>{
	let data = req.body;
	connection.query('update outpass set status = "rejected" where id = ?',[data.id]);
	alert("Rejected");
	console.log("rejected");
	res.redirect('/owarden');
})
// Outpass security
app.post("/osecuritylogin",(req,res)=>{
	let username = req.body.username;
	let password = req.body.password;
	if(username==='security' && password==='security@123'){
		connection.query('SELECT * FROM rgukt.outpass where status = "accepted"',(err,results)=>{
			if(err) throw err;
			if (results.length > 0) {
				req.session.loggedin = true;
				sessions=req.session;
				sessions.name=req.body.username;
				console.log(sessions);
				res.render('osecurity',{data:results});
			}else{
				res.render('osecurity',{data:results});
				console.log("security logged in");
			}
		})
	}
})
app.post('/ocheckin',(req,res)=>{
	let data = req.body;
	var now = new Date();
	var value = date.format(now,'YYYY-MM-DD [] HH:mm:ss');
	var val = new Date();
	value = value.toString();
	async.parallel([
		()=>{
			connection.query('update outpass set checkin = ? where id = ?',[value,data.id]);
		},
		()=>{
			connection.query('SELECT * FROM rgukt.outpass where status = "accepted";',(err,results)=>{
				if(err) throw err;
				res.render('osecurity',{data:results});
			})
		}
	])
})
app.post('/ocheckout',(req,res)=>{
	let data = req.body;
	const value = date.format(new Date(),'YYYY-MM-DD HH:mm:ss');
	async.parallel([
		()=>{
			connection.query('update outpass set checkout = ? where id = ?',[value,data.id]);
		},
		()=>{
			connection.query('SELECT * FROM rgukt.outpass where status = "accepted";',(err,results)=>{
				if(err) throw err;
				res.render('osecurity',{data:results});
			})
		}
	])
})

// Mess
app.get('/mess',(req,res)=>{
	if(!sessions){
		res.sendFile(__dirname+'/public/mess.html');
	}else{
		connection.query('SELECT * FROM rgukt.mess',(err,results)=>{
			details=results;
			res.render('mess',{details:details});
		})
	}
})
app.get('/mtimetable',(req,res)=>{
	connection.query('SELECT * FROM rgukt.mess',(err,results)=>{
		details=results;
		res.render('mess',{details:details});
	})
})
app.get('/mstudentlogin',(req,res)=>{
	connection.query('SELECT * FROM rgukt.mess',(err,results)=>{
		details=results;
		res.render('mess',{details:details});
	})
})
app.post('/mstudentlogin', (req,res)=> {
	let username = req.body.username;
	let password = req.body.password;
	if (username && password) {
		async.parallel([
			()=>{
				connection.query('SELECT * FROM users WHERE username = ? AND password = ?', [username, password],(err,results)=>{
					if (err) throw err;
					if (results.length > 0) {
						req.session.loggedin = true;
						sessions=req.session;
						sessions.name=req.body.username;
						console.log(sessions);
						// res.send(`<h1 style="color:green;">You are logged in...</h1>`);
					}
					else {
						// res.send(`<h1 style="color:red;">Incorrect Username and/or Password!</h1>`);
						alert("Incorrect Username and/or Password!");
						// errmessage="Incorrect Username and/or Password!";
						res.redirect("/mess.html");
					}			
				})
			},
			()=>{
				connection.query('SELECT * FROM rgukt.mess',(err,results)=>{
					details=results;
					res.render('mess',{details:details});
				})
			}
		])
		
    }
});	
app.get('/mcomplaint',(req,res)=>{
	res.render('mcomplaint');
})
app.post('/mcomplaint',(req,res)=>{
	let data = req.body;
	console.log(data);
	connection.query('insert into rgukt.complaints values(?,?,?,?)',[data.id,data.name,data.date,data.complaint]);
	console.log("Complaint sended");
	alert("Complaint sent successfully");
	res.redirect('back');
})
app.get('/mfeedback',(req,res)=>{
	res.render('mfeedback');
})
app.post('/mfeedback',(req,res)=>{
	let data = req.body;
	console.log(data);
	connection.query('insert into rgukt.feedback values(?,?,?,?,?,?,?,?,?,?,?,?)',[data.id,data.qrice,data.qcurry,data.segg,data.qsnack,data.tservice,data.qfood,data.nsurround,data.cworker,data.fguide,data.orate,data.suggest]);
	alert("Feedback submitted successfully");
	console.log("Feedback submitted successfully");
	res.redirect('back');
})
// Mess admin
app.get('/madmin',(req,res)=>{
	connection.query('SELECT * FROM rgukt.mess',(err,results)=>{
		if(err) throw err;
		res.render('madmin',{details:results});
	})
})
app.post("/madminlogin",(req,res)=>{
	let username = req.body.username;
	let password = req.body.password;
	if(username==='admin' && password==='admin@123'){
		connection.query('SELECT * FROM rgukt.mess',(err,results)=>{
			if(err) throw err;
			if (results.length > 0) {
				req.session.loggedin = true;
				sessions=req.session;
				sessions.name=req.body.username;
				console.log(sessions);
				res.render('madmin',{details:results});
			}else{
				res.render('madmin',{details:results});
				console.log("Admin  logged in");
			}
		})
	}
})
app.get('/mcomplaints',(req,res)=>{
	connection.query('select * from rgukt.complaints',(err,results)=>{
		if(err) throw err;
		if(results.length > 0){
			res.render('mcomplaints',{details:results});
		}else{
			alert('No data found');
			res.render('mcomplaints',{details:results});
		}
	})
})
app.post('/mdelete',(req,res)=>{
	let data = req.body;
	connection.query('delete from rgukt.complaints where id = ?',[data.id]);
	console.log("complaint deleted");
	res.redirect('back');
})
app.get('/mreports',(req,res)=>{
	connection.query('select avg(qrice),avg(qcurry),avg(segg),avg(qsnack),avg(tservice),avg(qfood),avg(nsurround),avg(cworker),avg(fguide),avg(orate) from rgukt.feedback;',(err,results)=>{
		if(err) throw err;
		res.render('mreports',{data:Object.values(results[0])});
	})
})



app.listen(3000,()=>{
    console.log("Server is running at 127.0.0.1:3000");
})