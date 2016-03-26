/**
 * Created by Georgi on 26.3.2016 г..
 */
(function(angular) {
    'use strict';
    var app = angular.module('main', []);

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
            result = $http.get('/api/play/' + id).success(function(data){
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
        }
    }]);
    app.controller('myCtrl', function(ApiCall) {
        this.allSongs = [];
        this.url = '';
        this.playerStatus = false;

        var $this = this;
        ApiCall.GetAllSongs().success(function(data) {
            $this.allSongs = data;
        });
        this.message = "John";
        this.lastName = "Doe";

        this.PlaySound = function(id){
            ApiCall.Play(id).success(function (data) {
                if(data.success){
                    $this.playerStatus = data.status;
                }
            });
        };

        this.AddSong = function() {
            ApiCall.AddSong(this.url).success(function(data) {
                if(typeof data !== "undefined"){
                    $this.allSongs.push(data);
                }
            });
        };
    });
})(window.angular);