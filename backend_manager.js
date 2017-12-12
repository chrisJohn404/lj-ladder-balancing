
const q = require('q');
const async = require('async');
const child_process = require('child_process');
const path = require('path');


var eventMap = require('./lib/backend_manager_events.js').events;
exports.events = eventMap;

var ENABLE_DEBUG_LOG = false;
var ENABLE_PRINTING = false;

function getPrinter(title, bool) {
	return function print() {
		if(bool) {
			var dataToPrint = [];
			dataToPrint.push('('+title+')');
			for(var i = 0; i < arguments.length; i++) {
				dataToPrint.push(arguments[i]);
			}
			console.log.apply(console, dataToPrint);
		}
	};
}

var DEBUG_STATUS_UPDATES = true;
const printStatusInfo = getPrinter('status', DEBUG_STATUS_UPDATES);

const EventEmitter = require('events');


var os = {
	'darwin': 'darwin',
	'win32': 'win32'
}[process.platform];
if(typeof(os) === 'undefined') {
	os = 'linux';
}

var sysNodePath = '';
sysNodePath = {
	'darwin': '/usr/',
	'win32': path.join(process.env.ProgramFiles, 'nodejs', 'node.exe'), // get using windows registry.
	'linux': '/usr/local/bin/node',
}[os];

if(os === 'darwin') {
	console.error('backend_manager.js IMPLEMENT ME!');
}



class BackendManager extends EventEmitter {
	constructor() {
		super();
		this.name = 'backend_manager';
		this.timeCreated = new Date();
		this.isStarted = false;
		this.subprocess = undefined;
	}

	// Example Getter
	get info() {
		return {
			'name': this.name,
			'curTime': new Date(),
		};
	}

	
	stdinListener(data) {
		printStatusInfo('in stdinListener:', data);
		// console.log('Data from running cmd:', findNPMCmd(cmd));
		console.log(data.toString());
	}
	stderrListener(data) {
		// console.log('Data from running cmd:', findNPMCmd(cmd));
		printStatusInfo('in stderrListener:', data);
		console.log(data.toString());
	}
	initialize() {
		const defered = q.defer();
		var backendPath = path.join(process.cwd(),'app_backend.js');

		console.log('node path', sysNodePath);
		console.log('backendPath', backendPath);


		this.subProcess = child_process.fork(
		backendPath,
		// ['--start'],// string arguments
		{
			cwd:process.cwd(),
			// env: {},
			execPath: sysNodePath,
			// execArgv: process.execArgv,
			stdio: [
				// 'pipe',
				// 'pipe',
                // process.stdin,
                // 'pipe',
                // process.stdout,
                // process.stderr,
                'pipe','pipe','pipe',
                'ipc',
                // 'pipe',
                // 'pipe'
            ]
		}
		);
		this.subProcess.on('error', errorListener);
		this.subProcess.on('exit', exitListener);
		this.subProcess.on('close', closeListener);
		this.subProcess.on('disconnect', disconnectListener);
		this.subProcess.on('message', messageListener);
		// subProcess.stdout.on('data', this.stdinListener);
		// subProcess.stderr.on('data', this.stderrListener);

		this.emit(eventMap.BACKEND_STARTED, {});
		defered.resolve();
		return defered.promise;
	}
	terminate() {
		subprocess.kill('SIGHUP');
	}

}
const backendManager = new BackendManager();

function errorListener(data) {
	printStatusInfo('in errorListener:', data);
}
function exitListener(data) {
	printStatusInfo('in exitListener:', data);
}
function closeListener(data) {
	printStatusInfo('in closeListener:', data);
}
function disconnectListener(data) {
	printStatusInfo('in disconnectListener:', data);
}
function messageListener(data) {
	// printStatusInfo('in messageListener:', data);
	if(typeof(data.evt) !== 'undefined') {
		// printStatusInfo('Got Event', data.evt);
		if(typeof(data.evt.key) !== 'undefined' && typeof(data.evt.data) !== 'undefined' ) {
			// printStatusInfo('Got Event (2)', data.evt, eventMap[data.evt.key]);
			if(typeof(eventMap[data.evt.key]) !== 'undefined') {
				// console.log('Emitting event', eventMap[data.evt.key], data.evt.data);
				backendManager.emit(eventMap[data.evt.key], data.evt.data);
			}
		}
	}
}

exports.start = function() {
	var startSteps = [
		'startSubProcess',

	]
}

exports.stop = function() {

}
exports.backendManager = backendManager;