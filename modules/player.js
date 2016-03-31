/**
 * Created by Georgi on 27.3.2016 г..
 */
var CorePlayer = require('./core_player'),
    EventEmitter = require('events').EventEmitter.prototype,
    _ = require('lodash');

var defaults = {
    verbose: false,
    debug: false
};

var Player = function(options) {
    options = _.defaults(options || {}, defaults);

    this.player = new CorePlayer(options);
    this.status = {
        muted: false,
        playing: false,
        volume: 0
    };

    this.player.once('ready', function() {
        if(options.verbose) {
            console.log('player.ready');
        }
        this.emit('ready');
    }.bind(this));

    this.player.on('statuschange', function(status) {
        this.status = _.extend(this.status, status);
        if(options.verbose) {
            console.log('player.status', this.status);
        }
        this.emit('status', this.status);
    }.bind(this));

    this.player.on('durationget', function(data) {
        if(options.verbose) {
            console.log('player.duration');
        }
        this.emit('duration', data);
    }.bind(this));

    this.player.on('playstart', function(data) {
        if(options.verbose) {
            console.log('player.start');
        }
        this.emit('start');
    }.bind(this));

    this.player.on('playstop', function() {
        if(options.verbose) {
            console.log('player.stop');
        }
        this.emit('stop')
    }.bind(this));

    this.player.on('playfinish', function() {
        if(options.verbose) {
            console.log('player.finish');
        }
        this.emit('finishplay')
    }.bind(this));

    var pauseTimeout,
        paused = false;

    this.player.on('timechange', function(time) {
        this.status.position = time;
        this.emit('time', time);
        if(options.verbose) {
            console.log('player.time', time);
        }
    }.bind(this));

    //Running the time change watcher
    var $this = this;
    setInterval(function(){
        if($this.status.playing){
            $this.player.cmd('get_time_pos');
        }
    }, 1000);
};

Player.prototype = _.extend({
    setOptions: function(options) {
        if(options && options.length) {
            options.forEach(function(value, key) {
                this.player.cmd('set_property', [key, value]);
            }.bind(this));
        }
    },
    openFile: function(file, options) {
        this.player.cmd('stop');

        this.setOptions(options);
        this.player.cmd('loadfile', ['"' + file + '"']);

        this.status.playing = true;
    },
    openPlaylist: function(file, options) {
        this.player.cmd('stop');

        this.setOptions(options);
        this.player.cmd('loadlist', ['"' + file + '"']);

        this.status.playing = true;
    },
    play: function() {
        if(!this.status.playing) {
            this.player.cmd('pause');
            this.status.playing = true;
        }
    },
    pause: function() {
        if(this.status.playing) {
            this.player.cmd('pause');
            this.status.playing = false;
        }
    },
    stop: function() {
        this.player.cmd('stop');
    },
    seek: function(seconds) {
        this.player.cmd('seek', [seconds, 2]);
    },
    seekPercent: function(percent) {
        this.player.cmd('seek', [percent, 1]);
    },
    volume: function(percent) {
        this.status.volume = percent;
        this.player.cmd('volume', [percent, 1]);
    },
    mute: function() {
        this.status.muted = !this.status.muted;
        this.player.cmd('mute');
    }
}, EventEmitter);

module.exports = Player;
