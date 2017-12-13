console.log('in app_backend!!!');


process.send({
	nodeVersion: process.version,
	nodeArch: process.arch,
	path: process.cwd(),
	paths: module.paths,
});
setTimeout(function(){
	console.log('done');
	process.send({
		nodeVersion: process.version,
		nodeArch: process.arch,
		path: process.cwd(),
	});
}, 1000);

process.on('unhandledRejection', function(reason, p) {
	process.send('In unhandledRejection', reason);
});
process.on('uncaughtException', function(err) {
	process.send('in uncaughtException', err, err.stack);
});




function getGameState(FIO4, FIO5) {
	var state = '';
	if(FIO4 == 1) {
		// Legs are on ground
		if(FIO5 == 1) {
			// User is on ladder
			state='ready';
		} else {
			// User is off ladder
			state='readyForNewUser';
		}
	} else {
		// Legs are off ground
		if(FIO5 == 1) {
			// User is on ladder
			state='balancing';
		} else {
			// User is off ladder
			state='notReady';
		}
	}
	return state;
}
var channelMeanings = {
	'FIO4': 'legs',
	'FIO5': 'standing'
};

var q = require('q');
var async = require('async');
var path = require('path');
var eventMap = require('./lib/backend_manager_events.js').events;

try {

var dcPath = path.join(process.cwd(),'node_modules','ljswitchboard-ljm_device_curator');
var device_curator = require(dcPath);
var ljm_device_manager = require('ljswitchboard-ljm_device_manager');
var deviceManager = ljm_device_manager.load();

function getDMEventListener(eventName) {
	return function dmEventListener(eventInfo) {
		process.send({txt:'dmEventListener', name:eventName, info:eventInfo});
	};
}
var dmEvents = ljm_device_manager.eventList;
var dmEventKeys = Object.keys(dmEvents);
dmEventKeys.forEach(function(eventKey) {
	var eventName = dmEvents[eventKey];
	deviceManager.on(eventName, getDMEventListener(eventName));
});

var gameState = {
	'curTime': new Date(),
	'AIN0_VAL': 0,
	'FIO4': 0,
	'FIO5': 0,
	'USER_ON_LADDER': false,
	'LADDER_ON_GROUND': false,
	'sn': 0,
	'ct': '',
	'currentState': 'notReady',
	'startTimeMS': 0,
	'finishingTimeMS': 0,
	'cheated': false,

	'duration': 0,
	'timeReported': true,

	'message': '',
	'messageReported': true,
	
};

var openedDeviceInfo;
function openDevice() {
	var defered = q.defer();

	deviceManager.open({deviceType:'LJM_dtT4',connectionType:'LJM_ctEthernet',identifier:440010101})
	.then(function(deviceInfo) {
		openedDeviceInfo = {
			'dt': deviceInfo.savedAttributes.productType,
			'ct': deviceInfo.savedAttributes.connectionTypeName,
			'sn': deviceInfo.savedAttributes.serialNumber,
			'ljmHandle': deviceInfo.savedAttributes.handle,
		};
		console.log('Opened Device!', {
			'dt': deviceInfo.savedAttributes.productType,
			'ct': deviceInfo.savedAttributes.connectionTypeName,
			'sn': deviceInfo.savedAttributes.serialNumber,
			'ljmHandle': deviceInfo.savedAttributes.handle,
		});

		gameState.ct = deviceInfo.savedAttributes.connectionTypeName;
		gameState.sn = deviceInfo.savedAttributes.serialNumber;
		defered.resolve();
	})
	.catch(function(err) {
		console.log('Did not open device', err);
		defered.resolve();
	});

	return defered.promise;
}


function closeDevice() {
	var defered = q.defer();

	console.log('Closing Device');
	deviceManager.close(openedDeviceInfo)
	.then(function(closeInfo) {
		console.log('Device closed!', closeInfo);
		defered.resolve();
	})
	.catch(function(err) {
		console.log('Did not close device', err);
		defered.resolve();
	});

	return defered.promise;
}

function getDevice() {
	var devices = deviceManager.getDevices();
	return devices[Object.keys(devices)[0]];

}

function sendEvent(key, data) {
	process.send({
		evt: {
			key: key,
			data: data,	
		}
	});
}
function updateTime() {
	var time = new Date();
	sendEvent(eventMap.UPDATE_CURRENT_TIME, time);
}


function updateState(val) {
	sendEvent(eventMap.UPDATE_GAME_STATE, gameState);
	if(gameState.timeReported == false) {
		gameState.timeReported = true;
		gameState.duration = 0;
	}
	if(gameState.messageReported == false ) {
		gameState.messageReported = true;
	}
}
function updateDisplay() {
	// var defered = q.defer();


	/* Code to communicate with the connected device */
	var keys = Object.keys(deviceManager.getManagedDevicesListSync());
	// process.send({devInfo:keys});

	var devices = deviceManager.getDevices();
	var device = devices[Object.keys(devices)[0]];
	var keys = Object.keys(device);
	// process.send({devInfo:device.savedAttributes});


	// updateTime();
	updateState();
	

	// setTimeout(updateDisplay, 1000)
	// defered.resolve();
	// return defered.promise;
}

function collectData() {
	var device = getDevice();
	device.iReadMany(['AIN0','FIO4','FIO5']).then(function(results) {

		gameState.AIN0_VAL = results[0].val;
		gameState.FIO4 = results[1].val;
		gameState.FIO5 = results[2].val;

		var curState = gameState.currentState;
		var newState = getGameState(gameState.FIO4, gameState.FIO5);

		if(newState != curState) {
			// Started a new thrust...
			if(curState === 'ready' && newState === 'balancing') {
				gameState.startTimeMS = new Date() - 0;
			}

			// Finished successfully
			if(curState === 'balancing' && newState === 'ready') {
				if(!gameState.cheated) {
					gameState.finishingTimeMS = new Date() - 0;
					gameState.duration = gameState.finishingTimeMS - gameState.startTimeMS;
					gameState.message = 'You thrusted!';
					gameState.timeReported = false;
					gameState.messageReported = false;
				} else {
					gameState.message = 'Ready';
					gameState.messageReported = false;
				}
			}

			// Falling off
			if(curState === 'balancing' && newState === 'notReady') {
				gameState.startTimeMS = 0;
				gameState.finishingTimeMS = 0;
				gameState.duration = 0;
				gameState.message = 'You Failed!';
				gameState.messageReported = false;
			}
			if(curState === 'notReady' && newState === 'balancing') {
				gameState.startTimeMS = 0;
				gameState.finishingTimeMS = 0;
				gameState.duration = 0;
				gameState.message = 'Stop Cheating!!, return to ready position!';
				gameState.messageReported = false;
				gameState.cheated = true;
			}
		} else {
			if(newState === 'readyForNewUser') {
				gameState.startTimeMS = 0;
				gameState.finishingTimeMS = 0;
				gameState.duration = 0;
				gameState.timeReported = true;
				gameState.messageReported = true;
			}
			if(newState === 'balancing') {
				if(!gameState.cheated) {
					gameState.duration = new Date() - gameState.startTimeMS;
				}
			}
			if(newState === 'ready') {
				gameState.cheated = false;
				gameState.startTimeMS = 0;
				gameState.finishingTimeMS = 0;
				gameState.duration = 0;
			}
			if(newState === 'notReady') {
				gameState.startTimeMS = 0;
				gameState.finishingTimeMS = 0;
				gameState.duration = 0;
			}
		}

		gameState.currentState = newState;
		gameState.curTime = new Date();


		if(!gameState.timeReported || !gameState.messageReported) {
			updateState();
		}
		
		// setTimeout(collectData, 50);
	}, function(err) {
		gameState.currentState = 'connect T4';

		// updateState();
		// setTimeout(collectData, 50);
	});
	
}
function startApp() {
	var defered = q.defer();
	// Start the dislay updating loop.
	setInterval(updateDisplay, 250);
	setInterval(collectData, 50);
	

	return defered.promise;
}
var startupCMDS = [
	openDevice,
	startApp,
	closeDevice,
	// openDevice,
	// startRepl,
];


async.eachSeries(
	startupCMDS,
	function(startupCMD, cb) {

		try {

			startupCMD()
			.then(cb)
			.catch(function(err) {
				console.log('Error Executing cmd', err);
				cb(err);
			});
		} catch(err) {
			process.send({
				err:err,
				st:err.stack,
			})
			cb(err);
		}
	},
	function(err) {
		if(err) {
			// console.log('Error Executing.... FF', err);
		} else {
			// console.log('Finished Executing!');	
		}
		// startRepl();
	});

} catch (err) {
	process.send({'err': JSON.stringify(err), curTime: new Date(), stack:new Error().stack, st:err.stack})
}