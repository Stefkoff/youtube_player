var youtubedl = require('youtube-dl');
var fs = require('fs');
var redis = require('redis');
var Mplayer = require('mplayer');
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var server = express();
var player1 = new Mplayer();

server.use(express.static(__dirname + '/public'));
server.use(bodyParser.json());
server.use(bodyParser.urlencoded({ extended: false }));

server.get('/', function(req, res) {
    res.sendFile('index');
});

server.get('/play', function(req, res) {
    player1.openFile('./music/H7HmzwI67ec.mp3');
    res.sendfile('./public/play.html');
});

server.get('/api/all', function(req, res) {
    var redisClient = redis.createClient({host: 'stefkoff.ddns.net', port: '6379'});

    redisClient.on('connect', function() {
        this.select(1, function(err, rep) {
            if(!err){
                var songs = [];
                    redisClient.keys('music:*', function(err, keys) {
                    if(!err){
                        var keysLen = keys.length;

                        var index = 0;
                        var totLen = keysLen;
                        for(var i = 0; i < keysLen; i++){
                            redisClient.hgetall(keys[i], function(err1, song){
                                index++;
                                if(!err){
                                    songs.push(song);
                                    if(index === totLen){
                                        res.send(JSON.stringify(songs));
                                    }
                                } else{
                                    index--;
                                    totLen--;
                                }
                            });
                        }
                    }
                })
            }
        });
    });
});

server.get('/api/play/:id', function(req, res) {
    var id = req.params.id;

    player1.openFile('./music/' + id + '.mp3');

    res.send(JSON.stringify({success: true, status: player1.status.playing}));
});

server.post('/api/add', function(req, res) {
    var url = req.body.url;
    youtubedl.getInfo(url, [], function(err, info) {
        if(err) return;

        var redisClient = redis.createClient({host: 'stefkoff.ddns.net', port: '6379'});

        redisClient.on('connect', function() {
            this.select(1, function() {
                redisClient.exists('music:' + info.id, function (err1, exist) {
                    if(exist !== 1){
                        youtubedl.exec(url, ['-x', '--audio-format', 'mp3'], {}, function exec(err, output) {
                            'use strict';
                            if (err) { throw err; }
                            var filename = '';
                            for(var i in output){
                                if(output[i].search('ffmpeg') !== -1){
                                    filename = output[i].substring('[ffmpeg] Destination: '.length);
                                    break;
                                }
                            }

                            fs.rename(filename, 'music/' + info.id + '.mp3', function(){
                                var thumb = info.thumbnails[0].url;

                                redisClient.hmset('music:' + info.id, {
                                    id: info.id,
                                    thumbnail: thumb,
                                    title: info.title
                                }, function() {
                                    res.send(JSON.stringify({
                                        id: info.id,
                                        thumbnail: thumb,
                                        title: info.title
                                    }));
                                });
                            });
                        });
                    }
                });
            });
        });

    });
});

server.listen(80, function(){
    console.log('server started');
});