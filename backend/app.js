require('dotenv').config(); // Nodemon Reload Trigger 3
var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
var cors = require('cors');

var indexRouter = require('./routes/index');
var usersRouter = require('./routes/users');
var authRouter = require('./routes/auth');
var pelangganRouter = require('./routes/pelanggan');
var paketRouter = require('./routes/paket');
var mikrotikRouter = require('./routes/mikrotik');
var reminderRouter = require('./routes/reminder');
var customerAuthRouter = require('./routes/customerAuth');
var customerPortalRouter = require('./routes/customerPortal');
var pembayaranRouter = require('./routes/pembayaran');
var pengeluaranRouter = require('./routes/pengeluaran');
var reportsRouter = require('./routes/reports');

// Database Connection
var db = require('./config/db');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

// CORS — izinkan React frontend (port 3001)
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));

app.use(logger('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// Routes
app.use('/', indexRouter);
app.use('/users', usersRouter);
app.use('/api/auth', authRouter);
app.use('/api/pelanggan', pelangganRouter);
app.use('/api/paket', paketRouter);
app.use('/api/mikrotik', mikrotikRouter);
app.use('/api/reminder', reminderRouter);
app.use('/api/customer/auth', customerAuthRouter);
app.use('/api/customer/portal', customerPortalRouter);
app.use('/api/pembayaran', pembayaranRouter);
app.use('/api/pengeluaran', pengeluaranRouter);
app.use('/api/reports', reportsRouter);

// Start Cron Service
var cronService = require('./services/cronService');
cronService.start();

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler — JSON response untuk API
app.use(function(err, req, res, next) {
  var status = err.status || 500;

  // Jika request ke /api, kirim JSON
  if (req.originalUrl.startsWith('/api')) {
    return res.status(status).json({
      success: false,
      message: err.message || 'Internal Server Error',
      error: req.app.get('env') === 'development' ? err.stack : undefined
    });
  }

  // Non-API: render error page (EJS)
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(status);
  res.render('error');
});

module.exports = app;
