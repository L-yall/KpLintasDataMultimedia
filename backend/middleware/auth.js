var jwt = require('jsonwebtoken');

// Middleware untuk verifikasi JWT token
function verifyToken(req, res, next) {
  var authHeader = req.headers['authorization'];
  var token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

  if (!token) {
    return res.status(401).json({ 
      success: false, 
      message: 'Token tidak ditemukan. Silakan login terlebih dahulu.' 
    });
  }

  jwt.verify(token, process.env.JWT_SECRET, function(err, decoded) {
    if (err) {
      return res.status(403).json({ 
        success: false, 
        message: 'Token tidak valid atau sudah expired.' 
      });
    }
    req.adminId = decoded.id;
    req.adminUsername = decoded.username;
    next();
  });
}

module.exports = verifyToken;
