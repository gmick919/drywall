'use strict';

//dependencies
var config = require('./config'),
    express = require('express'),
    session = require('express-session'),
    mongoStore = require('connect-mongo')(session),
    http = require('http'),
    path = require('path'),
    passport = require('passport'),
    mongoose = require('mongoose'),
    helmet = require('helmet');

//create express app
var app = express();

//keep reference to config
app.config = config;

//setup the web server
app.server = http.createServer(app);

//setup socket.io
app.io = require('socket.io').listen(app.server);

//setup mongoose
app.db = mongoose.createConnection(config.mongodb.uri);
app.db.on('error', console.error.bind(console, 'mongoose connection error: '));
app.db.once('open', function () {
  //and... we have a data store
});

//config data models
require('./models')(app, mongoose);

//settings
app.disable('x-powered-by');
app.set('port', config.port);
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

//middleware
app.use(require('morgan')('dev'));
app.use(require('compression')());
app.use(require('serve-static')(path.join(__dirname, 'public')));
app.use(require('body-parser')());
app.use(require('method-override')());
//eis!!! app.use(require('cookie-parser')());
//eis!!!...
app.cookieParser = require('cookie-parser');
app.use(app.cookieParser('secret'));
//app.use(app.cookieParser());
//...eis!!!

//eis!!! app.sessionStore = new mongoStore({ url: config.mongodb.uri }); //eis!!!
app.sessionStore = new mongoStore({ url: "localhost/drywall/sessions" }); //eis!!!

app.use(session({
  //eis!!! secret: config.cryptoKey,
  secret: 'secret', //eis!!!
  //eis!!! store: new mongoStore({ url: config.mongodb.uri })
  key: 'connect.sid', //eis!!!
  store: app.sessionStore //eis!!!
}));
app.use(passport.initialize());
//eis!!! app.use(passport.session());
app.use(passport.session({ //eis!!!
    secret: 'secret',
    key: 'connect.sid',
    store: app.sessionStore
}));

helmet.defaults(app);

//response locals
app.use(function(req, res, next) {
  res.locals.user = {};
  res.locals.user.defaultReturnUrl = req.user && req.user.defaultReturnUrl();
  res.locals.user.username = req.user && req.user.username;
  next();
});

//global locals
app.locals.projectName = app.config.projectName;
app.locals.copyrightYear = new Date().getFullYear();
app.locals.copyrightName = app.config.companyName;
app.locals.cacheBreaker = 'br34k-01';

//setup passport
require('./passport')(app, passport, express);

//setup routes
require('./routes')(app, passport);

//route sockets
require('./sockets')(app);

//custom (friendly) error handler
app.use(require('./views/http/index').http500);

//setup utilities
app.utility = {};
app.utility.sendmail = require('./util/sendmail');
app.utility.slugify = require('./util/slugify');
app.utility.workflow = require('./util/workflow');

//listen up
app.server.listen(app.config.port, function(){
  //and... we're live
});
