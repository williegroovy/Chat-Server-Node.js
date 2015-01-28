var express = require('express'),
	app = express(),
	server = require('http').createServer(app),
	io = require('socket.io').listen(server),
	mongoose = require('mongoose');
	users = {};

server.listen(8080);

mongoose.connect('mongodb://localhost/chat', function(err) {
	if(err) {
		console.log(err);
	}else {
		console.log('Connected to mongodb');
	}
});

var chatSchema = mongoose.Schema({
	nick: String,
	msg: String,
	created: {type: Date, default: Date.now}
});

var Chat = mongoose.model('Message', chatSchema);

app.get('/', function(req, res) {
	res.sendFile(__dirname + '/index.html');
});

io.sockets.on('connection', function(socket) { 

	var query = Chat.find({}); 
		query.sort('-created').limit(8).exec(function(err, docs) {
		if(err) throw err;

		socket.emit('load old msgs', docs);
	});

	socket.on('new user', function(data, callback) {
		
		if(data in users) {
			callback(false);

		} else {
			callback(true);
			socket.nickname = data;
			users[socket.nickname] = socket;
			updateNicknames();
		}
	});

	function updateNicknames() {
		io.sockets.emit('usernames', Object.keys(users));
	}
	
	socket.on('send message', function(data, callback) {
		var msg = data.trim();

		if(msg.substring(0, 3) === '/w ') {
			msg = msg.substring(3);
			var index = msg.indexOf(' ');

			if(index !== -1) {
				var name = msg.substring(0, index);
				var msg = msg.substring(index + 1);

				if(name in users) {
					users[name].emit('whisper', {msg: msg, nick: socket.nickname});
				}else {
					callback('Error! Enter a valid user');
				}
			}else {
				callback('Error! Please enter a message for your whisper.');
			}
		}else {

			var newMsg = new Chat({msg: msg, nick: socket.nickname});
			newMsg.save(function(err){
				if(err) throw err;
				io.sockets.emit('new message', {msg: data, nick: socket.nickname});
			});
		}
	});

	socket.on('disconnect', function(data) {
		if(!socket.nickname) return;

		delete users[socket.nickname];
		updateNicknames();
	});
});