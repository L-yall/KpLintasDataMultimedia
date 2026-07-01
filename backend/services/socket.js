var socketIo = require('socket.io');

var io = null;

var SocketService = {
  init: function(server) {
    io = socketIo(server, {
      cors: {
        origin: ['http://localhost:3001', 'http://localhost:3000'],
        methods: ['GET', 'POST'],
        credentials: true
      }
    });

    io.on('connection', function(socket) {
      console.log('Client connected to WebSocket:', socket.id);
      
      socket.on('disconnect', function() {
        console.log('Client disconnected from WebSocket:', socket.id);
      });
    });

    return io;
  },

  getIO: function() {
    if (!io) {
      throw new Error('Socket.io has not been initialized!');
    }
    return io;
  },

  broadcast: function(event, data) {
    if (io) {
      io.emit(event, data);
    }
  }
};

module.exports = SocketService;
