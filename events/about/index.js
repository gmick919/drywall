'use strict';

exports.join = function(app, socket){
  return function() {
    socket.visitor = 'guest';
    if (socket.client && socket.client.request && socket.client.request.user &&  socket.client.request.user.username) {
        socket.visitor = socket.client.request.user.username;
    }
    socket.join('/about/');
    socket.broadcast.to('/about/').emit('/about/#newVisitor', socket.visitor);
  };
};

exports.send = function(app, socket){
  return function(message) {
    socket.broadcast.to('/about/').emit('/about/#incoming', socket.visitor, message);
  };
};
