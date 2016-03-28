/**
 * Created by Georgi on 26.3.2016 г..
 */
(function(angular) {
    'use strict';
    var app = angular.module('main', []);
    
    app.factory('socket', function($rootScope) {
        var socket = io.connect();

        return {
            on: function(eventName, callback){
                socket.on(eventName, function(){
                    var args = arguments;
                    $rootScope.$apply(function() {
                        callback.apply(socket, args);
                    });
                });
            },
            emit: function(eventName, data, callback) {
                socket.emit(eventName, data, function() {
                    var args = arguments;
                    $rootScope.$apply(function() {
                        if(callback){
                            callback.apply(socket, args);
                        }
                    });
                })
            }
        }
    });

    app.service('ApiCall', ['$http', function($http){
        var result;

        this.GetAllSongs = function() {
            result = $http.get('api/all').success(function(data, status) {
                result = (data);
            }).error(function() {
                alert('error');
            });

            return result;
        };

        this.Play = function (id){
            var result;
            if(typeof id !== "undefined"){
                result = $http.get('/api/play/' + id).success(function(data){
                    result = (data);
                });
            } else{
                result = $http.get('/api/resume').success(function(data){
                    result = (data);
                });
            }

            return result;
        };

        this.Pause = function(){
            var result;
            result = $http.get('/api/pause').success(function(data) {
                result = (data);
            });

            return result;
        };

        this.AddSong = function(url){
            var result;
            if(typeof url !== "undefined"){
                result = $http.post('/api/add', {url: url}).success(function(data) {
                    result = (data);
                });
            }

            return result;
        };

        this.Queue = function(id){
            var result;
            if(typeof id !== "undefined"){
                result = $http.post('/api/queue', {id: id}).success(function(data) {
                    result = (data);
                });
            }

            return result;
        };
    }]);

    app.service('Player', function(ApiCall, TimeConverter) {
        this.playState = false;
        this.inPause = false;
        this.id = '';
        this.title = '';
        this.thumbnail = false;
        this.queue = [];
        this.duration = 0;
        this.currentSec = 0;

        var $this = this;

        this.Play = function(id){
            if(typeof id === "undefined"){
                if($this.id !== '' && !$this.inPause){
                    id = $this.id;
                }
            }
            ApiCall.Play(id).success(function (data) {
                if(data.success && typeof data.update !== "undefined" && data.update){
                    $this.title = data.title;
                    $this.thumbnail = data.thumbnail;
                    $this.id = data.id;
                    $this.duration = TimeConverter.resolveSeconds(data.duration);
                    $this.currentSec = data.duration;
                }
                $this.playState = true;
                $this.inPause = false;
            });
        };

        this.Pause = function(){
            ApiCall.Pause().success(function (data) {
                if(data.success){
                    $this.playState = false;
                    $this.inPause = true;
                }
            });

        };

        this.Stop = function(){
            $this.playState = false;
            $this.inPause = false;
        };

        this.AddToQueue = function(song){
            if($this.queue.indexOf(song) < 0){
                $this.queue.push(song);
            }
        };

        this.RemoveFromQueue = function() {
            $this.queue.pop();
        };

        this.AddSong = function(url, callback) {
            ApiCall.AddSong(url).success(function(data) {
                if(typeof data !== "undefined"){
                    callback(data);
                }
            });
        };

        this.SetTitle = function(title){
            $this.title = title;
        };

        this.SetThumbnail = function(thumb){
            $this.thumbnail = thumb;
        };

        this.Player = this;
    });

    app.service('TimeConverter', function(){
        var formatTime = function(hours, minutes, seconds){
            var data = '';
            for(var i in arguments){
                if(arguments[i] < 10){
                    data = data + '0';
                }

                data += arguments[i];
                if(i < arguments.length - 1){
                    data += ':';
                }
            }

            return data;
        };

        this.resolveSeconds = function(seconds){
            var mins = parseInt(seconds / 60);
            var hours = 0;

            if(mins >= 60){
                hours = parseInt(mins / 60);
            }

            var secsLeft = Math.ceil(seconds - (mins * 60));
            formatTime(hours, mins, secsLeft);

            return formatTime(hours, mins, secsLeft);
        };
    });

    app.directive('tile', function() {
        var directive = {};

        directive.restrict = 'E';
        directive.templateUrl = 'tile.html';
        directive.scope = {
            song: '=song',
            controller: '=contr'
        };

        return directive;
    });

    app.controller('myCtrl', function(ApiCall, Player, TimeConverter, socket) {
        this.allSongs = [];
        this.queue = [];
        this.url = '';

        socket.on('timechange', function(data) {
            Player.currentSec = TimeConverter.resolveSeconds(data);
        });

        socket.on('queuechange', function(data) {
            Player.RemoveFromQueue();
            Player.SetTitle(data.title);
            Player.SetThumbnail(data.thumbnail);
        });

        socket.on('queueadd', function(data){
            if(data){
                if(isInQueue(data) === false){
                    Player.queue.push(data);
                }
            }
        });

        socket.on('pause', function(){
            Player.playState = false;
            Player.inPause = true;
        });

        socket.on('play', function(data){
            Player.playState = true;
            Player.inPause = false;
            if(data){
                Player.SetTitle(data.title);
                Player.SetThumbnail(data.thumbnail);
                Player.duration = TimeConverter.resolveSeconds(data.duration)
            }
        });

        socket.on('init', function(data) {
            if(data){
                var playState = false;
                if(data.state === 'playing'){
                    playState = true;
                }

                if(data.state !== "pause"){
                    Player.id = data.id;
                }

                var currentTime = 0;
                var currentDuration = 0;

                if(typeof data.time !== "undefined"){
                    currentTime = data.time;

                }

                if(typeof data.duration !== "undefined"){
                    currentDuration = data.duration;
                }

                Player.currentSec = TimeConverter.resolveSeconds(currentTime);
                Player.duration = TimeConverter.resolveSeconds(currentDuration);
                Player.playState = playState;
                Player.inPause = !playState;
                Player.queue = data.queue;
                Player.SetTitle(data.title);
                Player.SetThumbnail(data.thumbnail);
            }
        });

        var isInQueue = function(data){
            var queue = Player.queue;
            var found = false;
            for(var i in queue){
                if(queue[i].id == data.id){
                    found = true;
                }
            }

            return found;
        };

        var $this = this;
        ApiCall.GetAllSongs().success(function(data) {
            $this.allSongs = data;
        });

        this.PlaySound = function(id){
            Player.Play(id);
        };

        this.AddSong = function() {
            Player.AddSong(this.url, function(data) {
                $this.allSongs.push(data);
            });
        };

        this.AddToQueue = function(id){
            ApiCall.Queue(id).success(function(data) {
                if(data){
                    if(isInQueue(data) == false){
                        Player.AddToQueue(data);
                    }
                }
            })
        };
    });

    app.controller('playerController', function (Player) {
        this.player = Player.Player;

        this.Pause = function(){
            Player.Pause();
        };

        this.Resume = function(){
            Player.Play();
        };
    });
})(window.angular);