'use strict';

let Ant = require('../ant-plus');
let stick = new Ant.GarminStick2(3);
// let stick = new Ant.GarminStick2();
let bicyclePowerSensor = new Ant.BicyclePowerSensor(stick);
// let bicyclePowerScanner = new Ant.BicyclePowerScanner(stick);


bicyclePowerSensor.on('powerData', data => {
  console.log(`id: ${data.DeviceID}, cadence: ${data.Cadence}, power: ${data.Power}`);
  // Show me some numbers
  console.log(JSON.stringify(data, null,2))
  console.log(data.offset, 'offset')
  console.log(data.Slope, 'Hz/Nm Slope')
  console.log(data.CumulativeOperatingTime, 's', Math.round(data.CumulativeOperatingTime/60/60*100)/100, 'hours', Math.round(data.CumulativeOperatingTime/60/60/24*100)/100, 'days Cumulative Operating Time')
  console.log(data.FractionalBatteryVoltage+3, 'Volt')
});

bicyclePowerSensor.on('attached', function() {
	console.log('sensor attached');

	// Uncommenting any of those means you trigger changes on or send changes to your power meter.
	setTimeout(() => {
		// bicyclePowerSensor.generalCalibrationRequest(function() {
		// 	console.log('General Calibration Request');	
		// });
		
		// bicyclePowerSensor.setAutoZero(false, function() {
		// 	console.log('set Auto Zero to false');
		// });
	
		// bicyclePowerSensor.setSlope(278, function() {
		// 	console.log('set Slope to 278 (27.8Hz/Nm)');
		// });
	}, 10000); // without a delay, to allow the power meter to become ready to receive commands, the set command doesn't seem to succeed
	
});

stick.on('startup', function () {
	console.log('startup');
	bicyclePowerSensor.attach(0, 0);
});

if (stick.is_present()) {
	console.log('Stick is present');
} else {
	console.log('Stick is not present');
}

if (!stick.open()) {
	console.log('Stick not found!');
}
