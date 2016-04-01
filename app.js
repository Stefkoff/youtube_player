var youtubedl = require('youtube-dl');
var fs = require('fs');
var request = require('request');
var redis = require('redis');
var Player = require('./modules/player');
var express = require('express');
var bodyParser = require('body-parser');
var path = require('path');

var params = require('./modules/params');
try{
    params = require('./modules/params-devel');
} catch(e){

}

var currentPlayerTimer = 0;
var currentPlayerDuration = 0;
var volume = 0;

var redisConfig = {
    host: params.redisHost,
    port: params.redisPort
};

var app = express();
var server = require('http').Server(app);
var player1 = new Player();

var io = require('socket.io')(server);

var changeRedisStatus = function(data){
    var redisClient = redis.createClient(redisConfig);
    redisClient.on('connect', function(errConnection, redConnection) {
        if(!errConnection){
            this.select(params.redisDb, function(errSelect, resSelect) {
                if(!errSelect){
                    redisClient.hmset('info', data);
                }
            });
        }
    });
};

var downloadImage = function(uri, filename, callback){
    request(uri).pipe(fs.createWriteStream(filename)).on('close', callback);
};

player1.on('finishplay', function() {
    var redisClient = redis.createClient(redisConfig);

    redisClient.on('connect', function(errConnect, resConnect) {
        if(!errConnect){
            this.select(params.redisDb, function(errSelect, resSelect) {
                if(!errSelect){
                    redisClient.lpop('queue', function(errPop, resPop) {
                        if(!errPop){
                            if(resPop){
                                redisClient.hgetall('music:' + resPop, function(errGet, resMusic) {
                                    if(!errGet){
                                        io.emit('queuechange', {
                                            title: resMusic.title,
                                            id: resMusic.id
                                        });
                                        changeRedisStatus({
                                            state: 'playing',
                                            current: resMusic.id
                                        });
                                    }
                                });
                            } else{
                                changeRedisStatus({
                                    state: 'stopped',
                                })
                            }
                            player1.openFile('./music/' + resPop + '.mp3');
                        }
                    })
                }
            });
        }
    });
});

player1.on('time', function(time) {
    currentPlayerTimer = time;
    io.emit('timechange', time);
});

player1.on('duration', function(data) {
    changeRedisStatus({
        duration: data
    });
});

io.on('connection', function(socket) {
    var redisClient = redis.createClient(redisConfig);
    redisClient.on('connect', function(errConnection, redConnection) {
        if(!errConnection){
            this.select(params.redisDb, function(errSelect, resSelect) {
                if(!errSelect){
                    redisClient.hgetall('info', function(errGet, resGet) {
                        if(!errGet){
                            if(resGet){
                                if(typeof resGet.current !== "undefined"){
                                    redisClient.hgetall('music:' + resGet.current, function(errGetMusic, resGetMusic){
                                        if(!errGetMusic){
                                            var currentTime = 0, currentDuration = 0;
                                            if(typeof resGet.duration !== "undefined"){
                                                currentDuration = resGet.duration;
                                            }

                                            if(typeof resGet.currentTime !== "undefined"){
                                                currentTime = resGet.currentTime
                                            }

                                            redisClient.lrange('queue', 0, -1, function(errQueue, resQueue) {
                                                var listLen = resQueue.length;
                                                var data = [];

                                                var volume = 0;

                                                if(typeof resGet.volume !== "undefined"){
                                                    volume = resGet.volume;
                                                }

                                                if(listLen > 0){
                                                    var index = 0;
                                                    for(var i = 0; i < listLen; i++){
                                                        redisClient.hgetall('music:' + resQueue[i], function(errGetMusicQueue, resGetMusicQueue) {
                                                            index++;
                                                            if(!errGetMusicQueue){
                                                                data.push(resGetMusicQueue);

                                                                if(index == listLen){
                                                                    io.emit('init', {
                                                                        state: resGet.state,
                                                                        title: resGetMusic.title,
                                                                        id: resGetMusic.id,
                                                                        time: currentTime,
                                                                        duration: currentDuration,
                                                                        queue: data,
                                                                        volume: volume
                                                                    });
                                                                }
                                                            } else{
                                                                index--;
                                                                listLen--;
                                                            }
                                                        })
                                                    }
                                                } else{
                                                    io.emit('init', {
                                                        state: resGet.state,
                                                        title: resGetMusic.title,
                                                        id: resGetMusic.id,
                                                        time: currentTime,
                                                        duration: currentDuration,
                                                        queue: data,
                                                        volume: volume
                                                    });
                                                }
                                            });
                                        }
                                    });
                                }
                            }
                        }
                    });
                }
            });
        }
    });

    socket.on('disconnect', function () {
        changeRedisStatus({
            currentTime: currentPlayerTimer
        });
    });
});

app.use(express.static(__dirname + '/public'));
app.use('/node_modules', express.static(__dirname + '/node_modules'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.get('/', function(req, res) {
    res.sendFile('index');
});

app.get('/api/all', function(req, res) {
    var redisClient = redis.createClient({host: params.redisHost, port: params.redisPort});

    redisClient.on('connect', function() {
        this.select(params.redisDb, function(err, rep) {
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

app.get('/api/play/:id', function(req, res) {
    var id = req.params.id;

    var redisClient = redis.createClient({host: params.redisHost, port: params.redisPort});

    redisClient.on('connect', function(err, rep) {
        this.select(params.redisDb, function(errSelect, repSelect) {
            redisClient.hgetall('music:' + id, function(errGet, music) {
                if(!errGet){
                    changeRedisStatus({
                        state: 'playing',
                        current: music.id
                    });
                    player1.openFile('./music/' + id + '.mp3');
                    io.emit('play', {
                        title: music.title,
                        id: music.id,
                        duration: music.duration
                    });

                    res.send(JSON.stringify({
                        success: true,
                        update: true,
                        status: player1.status.playing,
                        title: music.title,
                        id: music.id,
                        duration: music.duration
                    }));
                }
            });
        });
    });
});

app.get('/api/pause', function(req, res) {
    changeRedisStatus({
        state: 'pause'
    });
    player1.pause();
    io.emit('pause');
    res.send({success: true});
});

app.get('/api/resume', function(req, res) {
    changeRedisStatus({
        state: 'playing'
    });
    player1.play();
    io.emit('play');
    res.send({success: true});
});

app.post('/api/queue', function(req, res) {
    var id = req.body.id;

    var redisClient = redis.createClient(redisConfig);

    redisClient.on('connect', function(errConnect, connect) {
        if(!errConnect){
            this.select(params.redisDb, function(errSelect, select) {
                if(!errSelect){
                    redisClient.lrem('queue', 0, id, function(errRem, removetElements) {
                        if(!errRem){
                            redisClient.rpush('queue', id, function(errPush, pushRes) {
                                if(!errPush){
                                    redisClient.hgetall('music:' + id, function(errGet, resGet) {
                                        if(!errGet){
                                            io.emit('queueadd', resGet);
                                            res.send(resGet);
                                        }
                                    });
                                }
                            })
                        }
                    });
                }
            });
        }
    })
});

app.get('/api/removequeue/:id', function(req, res) {
    var id = req.params.id;

    var redisClient = redis.createClient({host: params.redisHost, port: params.redisPort});

    redisClient.on('connect', function(err, rep) {
        this.select(params.redisDb, function(errSelect, repSelect) {
            redisClient.lrem('queue', 0, id, function(errRem, removetElements) {
                if(!errRem){
                    io.emit('queue-remove', {id: id});
                    res.send({success: true});
                }
            });
        });
    });
});

app.post('/api/volume', function(req, res) {
    var volume = req.body.value;
    changeRedisStatus({volume: volume});
    player1.volume(volume);
    io.emit('volume', volume);
    res.send({success: true});
});

app.post('/api/add', function(req, res) {
    io.emit('loading', true);
    var url = req.body.url;
    youtubedl.getInfo(url, [], function(err, info) {
        if(err) return;

        var redisClient = redis.createClient({host: params.redisHost, port: params.redisPort});

        redisClient.on('connect', function() {
            this.select(params.redisDb, function() {
                redisClient.exists('music:' + info.id, function (err1, exist) {
                    if(exist !== 1){
                        youtubedl.exec(url, ['-x', '--audio-format', 'mp3'], {}, function exec(err, output) {
                            'use strict';
                            if (err) { throw err; }

                            var notAllowedCharacters = ['|', '/'];

                            for(var i in notAllowedCharacters){
                                if(info.title.indexOf(notAllowedCharacters[i]) > -1){
                                    var oldTitle = info.title;
                                    info.title = oldTitle.substring(0, oldTitle.indexOf(notAllowedCharacters[i]));
                                    info.title = info.title + '_' + oldTitle.substring(oldTitle.indexOf(notAllowedCharacters[i]) + notAllowedCharacters[i].length);
                                }
                            }

                            var filename = info.title + '-' + info.id + '.mp3';

                            fs.rename(filename, 'music/' + info.id + '.mp3', function(){
                                var thumb = info.thumbnails[0].url;

                                var duration = info.duration;
                                var durationData = duration.split(':');

                                var durDataLen = durationData.length;

                                var durationInSec = 1;
                                for(var i = 0; i < durDataLen; i++){
                                    if(i < durDataLen - 1){
                                        durationInSec = durationInSec * durationData[i] * 60;
                                    } else{
                                        durationInSec = durationInSec + parseInt(durationData[i]);
                                    }
                                }

                                downloadImage(thumb, './public/images/thumbnails/' + info.id + '.jpeg', function(){
                                    redisClient.hmset('music:' + info.id, {
                                        id: info.id,
                                        title: info.title,
                                        duration: durationInSec
                                    }, function() {
                                        io.emit('new-song', {
                                            id: info.id,
                                            title: info.title
                                        });
                                        res.send(JSON.stringify({
                                            id: info.id,
                                            title: info.title
                                        }));
                                    });
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