/**
 * Created by Georgi on 26.3.2016 г..
 */
(function(angular) {
    'use strict';
    var CLIENT_SICRET = 'RtzZ1nbMlzOJAKrjrdEhdHUw';
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

    app.factory('YouTube', function($rootScope) {
        var CLIENT_ID = '364688060695-9crc1ceidshbi940ntdq1b5n663l48uc.apps.googleusercontent.com';
        var OAUTH2_SCOPES = [
            'https://www.googleapis.com/auth/youtube'
        ];
        setTimeout(function() {
            gapi.auth.authorize({
                client_id: CLIENT_ID,
                scope: OAUTH2_SCOPES,
                immediate: true
            }, function() {
                gapi.client.load('youtube', 'v3');
            });
        }, 1000);

        return {
            search: function(term, callback){
                var request = gapi.client.youtube.search.list({
                    q: term,
                    part: 'snippet'
                });

                request.execute(function() {
                    var args = arguments;
                    $rootScope.$apply(function() {
                        callback.apply(request, args);
                    });
                });
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

        this.RemoveFromQueue = function(id){
            var result;
            if(typeof id !== "undefined"){
                result = $http.get('/api/removequeue/' + id).success(function(data) {
                    result = (data);
                });
            }

            return result;
        };

        this.SetVolume = function(volume){
            var result;
            if(typeof volume !== "undefined"){
                result = $http.post('/api/volume', {value: volume}).success(function(data){
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
        this.volume = 0;
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

        this.RemoveFromQueue = function(id) {
            var newQueue = [];
            for(var i = 0; i < $this.queue.length; i++){
                if(typeof $this.queue[i].id !== "undefined" && $this.queue[i].id != id){
                    newQueue.push($this.queue[i]);
                }
            }

            $this.queue = newQueue;
        };

        this.AddSong = function(url, callback) {
            ApiCall.AddSong(url).success(function(data) {
                if(typeof data !== "undefined"){
                    if(typeof callback !== "undefined"){
                        callback(data);
                    }
                }
            });
        };

        this.SetVolume = function(volume, callback){
            ApiCall.SetVolume(volume).success(function(data) {
                if(typeof callback !== "undefined"){
                    callback(data);
                    $this.volume = volume;
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
        this.resolveSeconds = function(data){
            var sec_num = parseInt(data, 10); // don't forget the second param
            var hours   = Math.floor(sec_num / 3600);
            var minutes = Math.floor((sec_num - (hours * 3600)) / 60);
            var seconds = sec_num - (hours * 3600) - (minutes * 60);

            if (hours   < 10) {hours   = "0"+hours;}
            if (minutes < 10) {minutes = "0"+minutes;}
            if (seconds < 10) {seconds = "0"+seconds;}
            return hours+':'+minutes+':'+seconds;
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

    app.directive("owlCarousel", function() {
        return {
            restrict: 'E',
            transclude: false
        };
    });

    app.directive('volumeControl', function(){
        return {
            restrict: 'E',
            scope: {
                volume: '=volume',
                controller: '=controller'
            },
            template: "<div class='volume-control'><div class='slider'></div> </div>",
            link: function(scope, element){
                $(element).find('.slider').slider({
                    value: scope.volume,
                    range: 'min',
                    min: 0,
                    max: 100,
                    slide: function( event, ui ) {
                        scope.volume = ui.value;
                        scope.controller.SetVolume(scope.volume);
                    }
                });

                scope.$watch('volume', function(newValue){
                    $(element).find('.slider').slider("value", newValue);
                });
            }
        }
    });

    app.directive('owlCarouselItem', function() {
            return {
                restrict: 'A',
                transclude: false,
                scope: {
                    queue: '='
                },
                link: function(scope, element) {
                    // wait for the last item in the ng-repeat then call init
                    scope.$watch('queue', function() {
                        $(element).trigger('destroy.owl.carousel').removeClass('owl-carousel owl-loaded');
                        $(element.parent()).owlCarousel({
                            margin:10,
                            autoWidth: false,
                            responsive:{
                                0:{
                                    items:1
                                },
                                600:{
                                    items:3
                                },
                                1000:{
                                    items:5
                                }
                            }
                        });
                    });
                }
            };
        });

    app.directive('addsong', function(){
        var directive = {};

        directive.restrict = 'E';
        directive.template = '<div class="add-song"><input class="search-field" name="url" ng-model="controller.url"><a id="add-song-button" ng-click="controller.AddSong()" class="ng-class:controller.inLoading">{{controller.inLoading === "" ? "Add" : ""}}</a></div>';
        directive.scope = {
            controller: '=controller'
        };

        return directive;
    });

    app.directive('youtubesearch', function() {
        var directive = {};

        directive.restrict = 'E';
        directive.scope = {
            controller: '='
        };
        directive.templateUrl = 'youtube_search.html';
        directive.link = function(scope, element, attr) {
            $(element).find('#youbute-search-button').bind('click', function() {
                $(element).find('.search-results').show();
            });

            $(element).find('.search-item').bind('click', function() {
                $(element).find('.search-results').hide();
            });

            $(document).bind('click', function(event) {
                var eventClass = $(event.target).attr('class');
                if(eventClass){
                    var classes = eventClass.split(' ');
                    if(classes.indexOf("youtube-search") < 0 && classes.indexOf('youbute-search-button') < 0){
                        $(element).find('.search-results').hide();
                    }
                }
            });
        };

        return directive;
    });

    app.controller('YouTubeController', function(YouTube, Player, socket) {
        this.term = '';
        this.result = [];

        var $this = this;
        this.Search = function(){
            this.result = [];
            YouTube.search($this.term, function(res){
                if(res){
                    var result = res.result;
                    var items = result.items;
                    for(var i in items){
                        var item = items[i];
                        if(item.id.kind == "youtube#channel") continue;

                        var videoId = item.id.videoId;
                        var snippet = item.snippet;
                        var title = snippet.title;
                        var thumbnail = snippet.thumbnails.default.url;
                        $this.result.push({
                            title: title,
                            id: videoId,
                            thumbnail: thumbnail
                        });
                    }
                }
            });
        };

        this.Add = function(id) {
            if(id){
                Player.AddSong('https://www.youtube.com/watch?v=' + id, function(data) {
                    $this.term = '';
                });
            }
        };
    });

    app.controller('myCtrl', function(ApiCall, Player, TimeConverter, socket) {
        this.allSongs = [];
        this.queue = [];
        this.url = '';
        this.searchTerm = '';
        this.inLoading = '';

        socket.on('timechange', function(data) {
            Player.currentSec = TimeConverter.resolveSeconds(data);
        });

        socket.on('queuechange', function(data) {
            Player.RemoveFromQueue(data.id);
            Player.SetTitle(data.title);
            Player.id = data.id;
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
                Player.id = data.id;
                Player.duration = TimeConverter.resolveSeconds(data.duration)
            }
        });

        socket.on('new-song', function(data) {
            if(data){
                $this.inLoading = '';
                $this.allSongs.push(data);
            }
        });

        socket.on('loading', function(data) {
            if(data){
                $this.inLoading = 'loading';
            }
        });

        socket.on('queue-remove', function(data) {
            if(data){
                var newQueue = [];
                for(var i = 0; i < Player.queue.length; i++){
                    if(typeof Player.queue[i].id !== "undefined" && Player.queue[i].id != data.id){
                        newQueue.push(Player.queue[i]);
                    }
                }

                Player.queue = newQueue;
            }
        });

        socket.on('volume', function(data) {
            if(data){
                Player.volume = data;
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
                Player.id = data.id;
                Player.volume = data.volume;
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
            $this.inLoading = 'loading';
            Player.AddSong(this.url);
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

    app.controller('playerController', function (Player, ApiCall) {
        this.player = Player.Player;

        this.Pause = function(){
            Player.Pause();
        };

        this.Resume = function(){
            Player.Play();
        };

        this.RemoveFromQueue = function(id){
            ApiCall.RemoveFromQueue(id).success(function() {
                Player.RemoveFromQueue(id);
            });
        };

        this.SetVolume = function(volume){
            Player.SetVolume(volume);
        }
    });
})(window.angular);