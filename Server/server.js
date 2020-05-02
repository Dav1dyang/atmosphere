//----------server essentials setup----------//
const http = require('http');
const bodyParser = require('body-parser');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const PORT = 3000;

//----------cookie, session, and user login middleware----------//
const cookieParser = require('cookie-parser');
const session = require('express-session');
const nedbstore = require('nedb-session-store')(session);
const bcrypt = require('bcryptjs');
const uuidV1 = require('uuid/v1');


//----------text analysis middleware----------//
const Datastore = require('nedb'); //future update to mongoDB
const striptags = require('striptags');
const Mercury = require('@postlight/mercury-parser');
const multer = require('multer');
//const language = require('@google-cloud/language');

var app = express();
var urlencodedParser = bodyParser.urlencoded({ extended: true }); // for parsing form data
var usersdataDB = new Datastore({ filename: "usersdata.db", autoload: true });
var registerDB = new Datastore({ filename: "registration.db", autoload: true });



app.use(express.static('public'));
app.set('view engine', 'ejs');
app.use(cors());
app.use(urlencodedParser);
app.use(cookieParser()); // Use the cookieParser middleware



//----------cookie, session, and Login----------//
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
		req.session.loginStatus = '';
		res.redirect('/login');
	}
});

//storing registration data to database
app.post('/register', function (req, res) {

	var passwordHash = generateHash(req.body.password); // We want to 'hash' the password so that it isn't stored in clear text in the database
	console.log(`entered: ${req.body.password} and stored ${passwordHash}`);

	// The information we want to store
	var registration = {
		'username': req.body.username,
		'password': passwordHash
	};

	registerDB.insert(registration); // Insert into the database
	console.log('inserted ' + registration);

	res.send('Registered Sign In'); // Give the user an option of what to do next

});

app.post('/loginsubmit', (req, res) => {
	registerDB.findOne({ 'username': req.body.username }, (err, doc) => {
		if (doc != null) {
			if (compareHash(req.body.passward, doc.passward)) {
				req.session.loginStatus = 'Loggedin';
				req.session.username = doc.username;
				req.session.lastlogin = Date.now();
				res.redirect('/');
			} else {
				req.session.loginStatus = 'INVALID: Please try again.';
				res.redirect('/login');
			}
		} else {
			req.session.loginStatus = 'INVALID: Please enter your username and passward';
			res.redirect('/login');
		}
	});
})

//Link to the login page
app.get('/login', (req, res) => {
	var data = { status: req.session.loginStatus }
	console.log(req.session.loginStatus);
	res.render('login.ejs', { data });
});

// Link to the registration page
app.get('/registration', (req, res) => {
	res.render('registration.ejs', {});
});

// generate passward's hash with salt
function generateHash(password) {
	var salt = bcrypt.genSaltSync(10); //generate salt (extra numbers to make pw more difficult to crack)
	return bcrypt.hashSync(password, salt);
}

//check if the stored hash is the same with the entered passward hash
function compareHash(password, hash) {
	return bcrypt.compareSync(password, hash);
}

//----------open port----------// 
app.listen(PORT, function () {
	console.log('Example app listening on port 3000!')
});