//----------server essentials setup----------//
const https = require('https');
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const HTTPSPORT1 = 443;
const HTTPSPORT2 = 444;
const HTTPPORT1 = 80;
require('dotenv').config();

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
const client = new OAuth2Client(CLIENT_ID);
async function verify() {
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
verify().catch(console.error);

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
			})
		}
	)
);

//----------cookie, session, and sign in----------//
app.get('/', (req, res) => {

	if (req.session.username) {

		if (!req.session.userid) {
			req.session.userid = uuidV1();
		}

		// Log the cookies on the server side
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
		res.send('You have visited this site ' + visits + ' times.' + 'session user-id: ' + req.session.userid + '. ');
	} else {
		delete req.session.signInStatus;
		res.render('homepageSignIn.ejs', {});
	}
});

//storing sign up data to database
app.post('/register', function (req, res) {
	registerDB.findOne({ 'username': req.body.username }, (err, doc) => {
		if (doc != null) {
			req.session.alreadyRegister = 'Username already being used!';
			res.redirect('/signup');
		} else {
			delete req.session.alreadyRegister;

			var passwordHash = generateHash(req.body.password); // We want to 'hash' the password so that it isn't stored in clear text in the database
			//console.log(`entered: ${req.body.password} and stored ${passwordHash}`);

			// The information we want to store
			var registration = {
				'username': req.body.username,
				'password': passwordHash
			};

			registerDB.insert(registration); // Insert into the database
			//console.log('inserted ' + registration);

			req.session.signInStatus = `Hi ${req.body.username}! Please sign in:`;
			res.redirect('/signin');
			//res.send('<html><head></head><body><h1>Registered</h1><a href="https://dy1096.itp.io:443/">sign in</a></body></html>'); // Give the user an option of what to do next
		}
	});
});

//check-in if the sign in info match the register database
app.post('/signinsubmit', (req, res) => {
	registerDB.findOne({ 'username': req.body.username }, (err, doc) => {
		if (doc != null) {
			console.log('password + hash: ' + req.body.username + ' ' + req.body.password + ' ' + doc.password);
			if (compareHash(req.body.password, doc.password)) {
				console.log('signincomparedtrue');
				req.session.signInStatus = 'Signned in';
				req.session.username = doc.username;
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
				req.session.signInStatus = 'INVALID: Please try again';
				res.redirect('/signin');
			} else {
				console.log('signin Invalid no entry');
				req.session.signInStatus = 'INVALID: Please enter your username and password';
				res.redirect('/signin');
			}
		}
	});
})

//Link to the sign in page
app.get('/signin', (req, res) => {
	delete req.session.alreadyRegister;
	var data = { status: req.session.signInStatus }
	//console.log(req.session.signInStatus);
	res.render('signIn.ejs', { data });
});

// Link to the registration page
app.get('/signup', (req, res) => {
	var data = { register: req.session.alreadyRegister };
	//console.log(req.session.alreadyRegister);
	res.render('signUp.ejs', { data });
});

// Link to the signout
app.get('/signout', (req, res) => {
	delete req.session.alreadyRegister;
	delete req.session.username;
	console.log('signed out');
	res.redirect('/');
});

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
DYHttpsServer.listen(HTTPSPORT1);

// var AtmosHttpsServer = https.createServer(AtmosCredentials, app);
// AtmosHttpsServer.listen(HTTPSPORT2);

//----------http connection----------// 
var httpapp = express();
httpapp.use(express.static('public'));
httpapp.get('/', (req, res) => {
	res.send('<html><head></head><body><h1>http</h1><a href="https://davidyang.cc/">To https</a></body></html>');
});

httpapp.listen(HTTPPORT1);
