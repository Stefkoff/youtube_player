/**
 * Created by Georgi on 27.3.2016 г..
 */
var spawn = require('child_process').spawn,
    EventEmitter = require('events').EventEmitter.prototype,
    _ = require('lodash');

var CorePlayer = function(options) {
    this.options = options;
    this.spawn();
};

CorePlayer.prototype = _.extend({
    spawn: function() {
        var instance = spawn('mplayer',
            ['-msglevel',  'global=6', '-msglevel', 'cplayer=4', '-idle', '-slave', '-fs', '-noborder', '-ao', 'pulse', '-identify']
        );

        this.setStatus();

        var startTime = Date.now();

        instance.stdout.on('data', this.onData.bind(this));
        instance.stderr.on('data', this.onError.bind(this));

        instance.on('exit', function() {
            if(Date.now() - startTime < 3000) {
                // Process is erroring too close to start up, abort.
                process.exit(1);
            }
            if(this.options.debug) {
                console.log('mplayer process exited, restarting...');
            }
            this.emit('playstop');
            this.spawn();
        }.bind(this));

        this.instance = instance;
    },
    cmd: function(command, arguments) {
        arguments = arguments || [];
        if(typeof arguments.length === 'undefined') {
            arguments = [arguments];
        }
        if(this.options.debug) {
            console.log('>>>> COMMAND: ' + command, arguments);
        }
        this.instance.stdin.write([command].concat(arguments).join(' ') + '\n');
    },
    getStatus: function() {
        this.cmd('get_time_length');
        this.cmd('get_vo_fullscreen');
        this.cmd('get_sub_visibility');
    },
    setStatus: function(status) {
        var defaults = {
            duration: 0,
            fullscreen: false,
            subtitles: false,
            filename: null,
            title: null
        };

        if(status) {
            this.status = _.defaults(_.extend(this.status || {}, status || {}), defaults);
        } else {
            this.status = _.defaults({}, defaults);
        }

        this.emit('statuschange', this.status);
    },
    onData: function(data) {
        if(this.options.debug) {
            console.log('stdout: ' + data);
        }

        data = data.toString();
        
        if(data.indexOf('MPlayer') === 0) {
            this.emit('ready');
            this.setStatus(false);
        }

        if(data.indexOf('StreamTitle') !== -1) {
            this.setStatus({
                title: data.match(/StreamTitle='([^']*)'/)[1]
            });
        }

        if(data.indexOf('Playing ') !== -1) {
            var file = data.match(/Playing\s(.+?)\.\s/)[1];
            this.setStatus(false);
            this.setStatus({
                filename: file
            });
            this.getStatus();
        }

        if(data.indexOf('Starting playback...') !== -1) {
            this.emit('playstart');
        }

        if(data.indexOf('EOF code:') > -1) {
            var code = data.substring(data.indexOf('EOF code:') + 'EOF code:'.length).trim();
            if(code == 1){
                this.emit('playfinish');
            }
            this.emit('playstop');
            this.setStatus();
        }

        if(data.indexOf('ANS_TIME_POSITION=') !== -1){
            var position = data.indexOf('=') + 1;

            var time = data.substring(position, data.length).trim();
            this.emit('timechange', time);
        }

        if(data.indexOf('ID_LENGTH') !== -1) {
            var duration = parseFloat(data.match(/ID_LENGTH=([0-9\.]*)/)[1]);
            this.setStatus({
                duration: duration
            });
            this.emit('durationget', duration);
        }

        if(data.indexOf('ANS_LENGTH') !== -1 && data.indexOf('ANS_VO_FULLSCREEN') !== -1 && data.indexOf('ANS_SUB_VISIBILITY') !== -1) {
            this.setStatus({
                duration: parseFloat(data.match(/ANS_LENGTH=([0-9\.]*)/)[1]),
                fullscreen: (parseInt(data.match(/ANS_VO_FULLSCREEN=([01])/)[1]) === 1),
                subtitles: (parseInt(data.match(/ANS_SUB_VISIBILITY=([01])/)[1]) === 1)
            });
        }
    },
    onError: function(error) {
        console.log(error.toString());
        if(this.options.debug) {
            console.log('stderr: ' + error);
        }
    }
}, EventEmitter);

module.exports = CorePlayer;
