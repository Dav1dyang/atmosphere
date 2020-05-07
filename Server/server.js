require('dotenv').config();

//----------server essentials setup----------//
const https = require('https');
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const HTTPSPORT1 = 443;
const HTTPSPORT2 = 444;
const HTTPPORT1 = 80;
const fetch = require("node-fetch");

//----------cookie, session, and user signin middleware----------//
const cookieParser = require('cookie-parser');
const session = require('express-session');
const nedbstore = require('nedb-session-store')(session);
const bcrypt = require('bcrypt');
const uuidV1 = require('uuid/v1'); //running with uuid@3 version in order to work


//----------text analysis middleware----------//
const Datastore = require('nedb'); //future update to mongoDB
const striptags = require('striptags');
const Mercury = require('@postlight/mercury-parser');
const multer = require('multer');
//const language = require('@google-cloud/language');

//----------Google Sign In option----------//
const { OAuth2Client } = require('google-auth-library');
const client = new OAuth2Client('382219507043-mn78i1knjl39o7ghstgc04aint0hqkb4.apps.googleusercontent.com');

async function verify(token) {
	const ticket = await client.verifyIdToken({
		idToken: token,
		audience: '382219507043-mn78i1knjl39o7ghstgc04aint0hqkb4.apps.googleusercontent.com',  // Specify the CLIENT_ID of the app that accesses the backend
		// Or, if multiple clients access the backend:
		//[CLIENT_ID_1, CLIENT_ID_2, CLIENT_ID_3]
	});
	const payload = ticket.getPayload();
	const userid = payload['sub'];
	// If request specified a G Suite domain:
	//const domain = payload['hd'];	
}

//----------global variable setup----------//
var DYCredentials = {
	key: fs.readFileSync('DYprivkey.key'),
	cert: fs.readFileSync('DYfullchain.pem')
};
// var AtmosCredentials = {
// 	key: fs.readFileSync('Atmosprivkey.key'),
// 	cert: fs.readFileSync('Atmosfullchain.pem')
// };
var app = express();
var urlencodedParser = bodyParser.urlencoded({ extended: true }); // for parsing form data
var usersdataDB = new Datastore({ filename: "usersdata.db", autoload: true });
var registerDB = new Datastore({ filename: "registration.db", autoload: true });

app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(cors());
app.use(urlencodedParser);
app.use(cookieParser()); // Use the cookieParser middleware
app.use(
	session(
		{
			secret: 'secret',
			cookie: {
				maxAge: 365 * 24 * 60 * 60 * 1000   // e.g. 1 year (days * hours * minutes * seconds * milliseconds)
			},
			store: new nedbstore({
				filename: 'sessions.db'
			}),
			resave: true,
			secure: true,
			saveUninitialized: true
		}
	)
);

//----------cookie, session, and sign in----------//
app.get('/', (req, res) => {
	//console.log(req.session.username);
	if (req.session.username != null) {

		if (!req.session.userid) {
			req.session.userid = uuidV1();
		}

		// Log the cookies on the server side
		console.log('cookie:');
		console.log(req.cookies);

		// Variable per request to keep track of visits
		var visits = 1;

		// If they have a 'visits' cookie set, get the value and add 1 to it
		if (req.cookies.visits) {
			visits = Number(req.cookies.visits) + 1;
		}

		// Set the new or updated cookie
		res.cookie('visits', visits, {});

		// Send the info to the user
		let data = {
			visits: visits,
			session_id: req.session.userid,
			signedIn: true
		}
		res.render('homepage.ejs', { data });
		//res.send('You have visited this site ' + visits + ' times.' + 'session user-id: ' + req.session.userid + '. ');
	} else {
		if (!req.session.userid) {
			req.session.userid = uuidV1();
		}
		req.session.signInStatus = null;

		let data = {
			visits: visits,
			session_id: req.session.userid,
			signedIn: false
		}
		res.render('homepage.ejs', { data });
	}
});

//storing sign up data to database
app.post('/register', function (req, res) {
	registerDB.findOne({ 'username': req.body.username }, (err, doc) => {
		if (doc != null) {
			req.session.alreadyRegister = 'Username already being used!';
			res.redirect('/signup');
		} else {
			req.session.alreadyRegister = null;

			var passwordHash = generateHash(req.body.password); // We want to 'hash' the password so that it isn't stored in clear text in the database

			//console.log(`entered: ${req.body.password} and stored ${passwordHash}`);

			// The information we want to store

			let registration = {
				'username': req.body.username,
				'firstname': req.body.firstname,
				'lastname': req.body.lastname,
				'password': passwordHash
			};
			req.session.signInName = req.body.firstname;
			registerDB.insert(registration); // Insert into the database
			//console.log('inserted ' + registration);
			req.session.signedIn = false;
			req.session.signInStatus = null;
			res.redirect('/signin');
			//res.send('<html><head></head><body><h1>Registered</h1><a href="https://dy1096.itp.io:443/">sign in</a></body></html>'); // Give the user an option of what to do next
		}
	});
	req.session.save();
});

//check-in if the sign in info match the register database
app.post('/signinsubmit', (req, res) => {
	registerDB.findOne({ 'username': req.body.username }, (err, doc) => {
		if (doc != null) {
			if (compareHash(req.body.password, doc.password) && doc.password != null) {
				console.log('signincomparedtrue');
				req.session.signInStatus = 'signned in';
				req.session.signedIn = true;
				req.session.username = doc.firstname;
				req.session.lastSignIn = Date.now();
				res.redirect('/');
			} else {
				console.log('signin Invalid password');
				req.session.signInStatus = 'INVALID: renter your password';
				res.redirect('/signin');
			}
		} else {
			if (req.body.username != '') {
				console.log('signin Invalid no match username');
				req.session.signInStatus = 'INVALID: no matched username';
				res.redirect('/signin');
			} else {
				console.log('signin Invalid no entry');
				req.session.signInStatus = 'INVALID: please enter your username and password';
				res.redirect('/signin');
			}
		}
	});
	req.session.save();
})

//Link to the sign in page
app.get('/signin', (req, res) => {
	//console.log(req.session.signedIn);
	if (req.session.signedIn == true) {
		res.render('alreadySignedIn.ejs', {});
	} else {
		if (req.query.new || req.query.submit == '') {
			req.session.alreadyRegister = null;
			req.session.signInStatus = null;
			var data = { status: req.session.signInStatus, name: null }
			//console.log(req.session.signInStatus);
			res.render('signIn.ejs', { data });
		} else {
			req.session.alreadyRegister = null;

			var data = { status: req.session.signInStatus, name: req.session.signInName }
			//console.log(req.session.signInStatus);
			res.render('signIn.ejs', { data });
		}
	}
});

// Link to the registration page
app.get('/signup', (req, res) => {
	if (req.session.signedIn == true) {
		res.render('alreadySignedIn.ejs', {});
	} else {
		if (req.query.new || req.query.submit == '') {
			req.session.alreadyRegister = null;
			var data = { register: req.session.alreadyRegister };
			res.render('signUp.ejs', { data });
		} else {
			var data = { register: req.session.alreadyRegister };
			//console.log(req.session.alreadyRegister);
			res.render('signUp.ejs', { data });
		}
	}
});

// Link to the signout
app.get('/signout', (req, res) => {
	req.session.signedIn = false;
	req.session.alreadyRegister = null;
	req.session.username = null;
	req.session.signInName = null;
	console.log('signed out');
	res.redirect('/');
});

app.post('/signoutgoogle', (req, res) => {
	if (req.body.signoutgoogle && req.body.signoutgoogle != null) {
		req.session.signedIn = false;
		req.session.alreadyRegister = null;
		req.session.username = null;
		req.session.signInName = null;
		// console.log(req.session.signedIn);
		console.log('google signed out (include normal sign out)');
	} else {
		console.log('google still signed in');
	}
	req.session.save();
});

app.post('/tokensignin', (req, res) => {
	// console.log('token: ' + req.body.idtoken);
	req.session.signedIn = true;
	req.session.lastSignIn = Date.now();
	req.session.save();
	var googleUser;
	fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${req.body.idtoken}`)
		.then(res => res.json())
		.then(data => googleUser = data)
		.then(() => {
			// console.log('all: ' + googleUser);
			// console.log('name: ' + googleUser.name);
			registerDB.findOne({ 'username': googleUser.sub }, (err, doc) => {
				if (doc != null) {
					// req.session.googleRegistered = true;
					req.session.username = doc.firstname;
					console.log('google user signed in');
					// console.log(doc.firstname);
					// console.log(req.session.username);
					// console.log(req.session.signedIn);
					req.session.save();
				} else {
					req.session.alreadyRegister = null;
					req.session.username = googleUser.given_name;
					let registration = {
						'username': googleUser.sub,
						'firstname': googleUser.given_name,
						'lastname': googleUser.family_name,
						'password': null
					};
					registerDB.insert(registration);
					console.log('registered new google user into database');
					req.session.save();
				}
			});

		});
});


app.post('/uploadchromedata', (req, res) => {
	//store data base on user
	//change req.session.username = googleuser's sub
	//create session variable userFirstName and firstTime
	//warn user about cookies
	//create a privacy policy, what is atmosphere, and example page
	//if (req.session.username == req.cookies.username)
})

// generate password's hash
function generateHash(password) {
	return bcrypt.hashSync(password, 10);
}

//check if the stored hash is the same with the entered password hash
function compareHash(password, hash) {
	console.log('Compare Hash:' + bcrypt.compareSync(password, hash));
	return bcrypt.compareSync(password, hash);
}

//----------open https port----------// 
var DYHttpsServer = https.createServer(DYCredentials, app);
DYHttpsServer.listen(HTTPSPORT1, () => {
	console.log(` HTTPS listening at port ${HTTPSPORT1}`)
});

// var AtmosHttpsServer = https.createServer(AtmosCredentials, app);
// AtmosHttpsServer.listen(HTTPSPORT2);

//----------http connection----------// 
var httpapp = express();
httpapp.use(express.static('public'));
httpapp.get('/', (req, res) => {
	res.send('<html><head></head><body><h1>http</h1><a href="https://davidyang.cc/">To https</a></body></html>');
});
httpapp.listen(HTTPPORT1, () => {
	console.log(` HTTP listening at port ${HTTPPORT1}`)
});
