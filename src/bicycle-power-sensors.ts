/*
* ANT+ profile: https://www.thisisant.com/developer/ant-plus/device-profiles/#521_tab
* Spec sheet: https://www.thisisant.com/resources/bicycle-power/
*/

import { AntPlusSensor, AntPlusScanner, Messages, SendCallback } from './ant';

class BicyclePowerSensorState {
	constructor(deviceID: number) {
		this.DeviceID = deviceID;
	}

	DeviceID: number;
	PedalPower?: number;
	RightPedalPower?: number;
	LeftPedalPower?: number;
	Cadence?: number;
	AccumulatedPower?: number;
	Power?: number;
	offset: number = 0;
	EventCount?: number;
	TimeStamp?: number;
	Slope?: number;
	TorqueTicksStamp?: number;
	CalculatedCadence?: number;
	CalculatedTorque?: number;
	CalculatedPower?: number;
	BatteryId?: number;
	CumulativeOperatingTime?: number;
	FractionalBatteryVoltage?: number;
	SlopeHzPerNm?: number;
	AutoZero?: boolean;
}

class BicyclePowerScanState extends BicyclePowerSensorState {
	Rssi: number;
	Threshold: number;
}

export class BicyclePowerSensor extends AntPlusSensor {
	static deviceType = 0x0B;

	public attach(channel, deviceID): void {
		super.attach(channel, 'receive', deviceID, BicyclePowerSensor.deviceType, 0, 255, 8182);
		this.state = new BicyclePowerSensorState(deviceID);
	}

	private state: BicyclePowerSensorState;

	protected updateState(deviceId, data) {
		this.state.DeviceID = deviceId;
		updateState(this, this.state, data);
	}

	private _generalCalibrationRequest(cbk?: SendCallback) {
		const payload = [0x01, 0xAA, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}
	public generalCalibrationRequest(cbk?: SendCallback) {
		return this._generalCalibrationRequest(cbk);
	}

	private _setAutoZero(autoZeroStatus: boolean, cbk?: SendCallback) {
		const az = autoZeroStatus ? 0x01 : 0x00;
		const payload = [0x01, 0xAB, az & 0xFF, 0xFF, 0xFF, 0xFF, 0xFF, 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}
	public setAutoZero(autoZeroStatus: boolean, cbk?: SendCallback) {
		return this._setAutoZero(autoZeroStatus, cbk);
	}

	private _setSlope(slope: number, cbk?: SendCallback) {
		const sl = slope === undefined ? 0xFFFF : Math.max(100, Math.min(500, Math.round(slope * 10)/10));
		const payload = [0x01, 0x10, 0x02, 0xFF, 0xFF, 0xFF, (sl >> 8) & 0xFF, sl & 0xFF];
		const msg = Messages.acknowledgedData(this.channel, payload);
		this.send(msg, cbk);
	}
	public setSlope(slope: number, cbk?: SendCallback) {
		return this._setSlope(slope, cbk);
	}
}

export class BicyclePowerScanner extends AntPlusScanner {
	protected deviceType() {
		return BicyclePowerSensor.deviceType;
	}

	private states: { [id: number]: BicyclePowerScanState } = {};

	protected createStateIfNew(deviceId) {
		if (!this.states[deviceId]) {
			this.states[deviceId] = new BicyclePowerScanState(deviceId);
		}
	}

	protected updateRssiAndThreshold(deviceId, rssi, threshold) {
		this.states[deviceId].Rssi = rssi;
		this.states[deviceId].Threshold = threshold;
	}

	protected updateState(deviceId, data) {
		updateState(this, this.states[deviceId], data);
	}
}

function updateState(
	sensor: BicyclePowerSensor | BicyclePowerScanner,
	state: BicyclePowerSensorState | BicyclePowerScanState,
	data: Buffer) {

	const page = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA);
	switch (page) {
		case 0x01: {
			const calID = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			if (calID === 0x10) {
				const calParam = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
				if (calParam === 0x01) {
					state.offset = data.readInt16BE(Messages.BUFFER_INDEX_MSG_DATA + 6);
				}
			}
			const autoZero = data.readInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			state.AutoZero = autoZero === 1 ? true : false;
			break;
		}
		case 0x02: { // Get/Set Parameters 
			break;
		}
		case 0x03: { // Measurement Output
			break;
		}
		case 0x10: {
			const pedalPower = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2);
			if (pedalPower !== 0xFF) {
				if (pedalPower & 0x80) {
					state.PedalPower = pedalPower & 0x7F;
					state.RightPedalPower = state.PedalPower;
					state.LeftPedalPower = 100 - state.RightPedalPower;
				} else {
					state.PedalPower = pedalPower & 0x7F;
					state.RightPedalPower = undefined;
					state.LeftPedalPower = undefined;
				}
			} else {
				state.PedalPower = undefined;
				state.RightPedalPower = undefined;
				state.LeftPedalPower = undefined;
			}
			const cadence = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 3);
			if (cadence !== 0xFF) {
				state.Cadence = cadence;
			} else {
				state.Cadence = undefined;
			}
			state.AccumulatedPower = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			state.Power = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);
			break;
		}
		case 0x11: { // Optional Torque main Data Page
			break;
		}
		case 0x12: { // Optional Torque main Data Page
			break;
		}
		case 0x13: { // Torque Efficiency and Pedal Smoothness
			break;
		}
		case 0x20: {
			const oldEventCount = state.EventCount;
			const oldTimeStamp = state.TimeStamp;
			const oldTorqueTicksStamp = state.TorqueTicksStamp;

			let eventCount = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 1);
			const slope = data.readUInt16BE(Messages.BUFFER_INDEX_MSG_DATA + 2);
			let timeStamp = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 4);
			let torqueTicksStamp = data.readUInt16LE(Messages.BUFFER_INDEX_MSG_DATA + 6);

			if (timeStamp !== oldTimeStamp && eventCount !== oldEventCount) {
				state.EventCount = eventCount;
				if (oldEventCount > eventCount) { //Hit rollover value
					eventCount += 255;
				}

				state.TimeStamp = timeStamp;
				if (oldTimeStamp > timeStamp) { //Hit rollover value
					timeStamp += 65400;
				}

				state.Slope = slope;
				state.SlopeHzPerNm = slope * 1/10
				state.TorqueTicksStamp = torqueTicksStamp;
				if (oldTorqueTicksStamp > torqueTicksStamp) { //Hit rollover value
					torqueTicksStamp += 65535;
				}

				const elapsedTime = (timeStamp - oldTimeStamp) * 0.0005;
				const torqueTicks = torqueTicksStamp - oldTorqueTicksStamp;

				const cadencePeriod = elapsedTime / (eventCount - oldEventCount); // s
				const cadence = Math.round(60 / cadencePeriod); // rpm
				state.CalculatedCadence = cadence;

				const torqueFrequency = (1 / (elapsedTime / torqueTicks)) - state.offset; // Hz
				const torque = torqueFrequency / (slope / 10); // Nm
				state.CalculatedTorque = torque;

				state.CalculatedPower = torque * cadence * Math.PI / 30; // Watts
			}
			break;
		}
		case 0x50: { // Manufacturer’s Information
			break;
		}
		case 0x51: { // would be Product Information
			break;
		}
		case 0x52: { // Battery Voltage
			const batId = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 2); // 0xff if not used
			state.BatteryId = batId;
			const cumOpTime = data.readUInt32LE(Messages.BUFFER_INDEX_MSG_DATA + 3) << 8 >> 8; // only 24 bits contain our data!
			state.CumulativeOperatingTime = cumOpTime * 16 // 2s or 16s
			const fraBatVolt = data.readUInt8(Messages.BUFFER_INDEX_MSG_DATA + 6);
			state.FractionalBatteryVoltage = fraBatVolt * 1/256;
			break;
		}
		default:
			return;
	}
	sensor.emit('powerData', state);
}
