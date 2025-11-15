import { Regex, SomeCompanionConfigField } from '@companion-module/base'

export interface ModuleConfig {
	host: string
	port: string
	enablePolling: boolean
	pollInterval: number
}

export function getConfigFields(): SomeCompanionConfigField[] {
	return [
		{
			type: 'static-text',
			id: 'info',
			width: 12,
			label: 'Information',
			value: 'This module controls Video Playback player via HTTP API',
		},
		{
			type: 'textinput',
			id: 'host',
			label: 'Target IP',
			width: 6,
			default: 'localhost',
			regex: Regex.HOSTNAME,
		},
		{
			type: 'textinput',
			id: 'port',
			label: 'Target Port',
			width: 6,
			default: '8090',
			regex: Regex.PORT,
		},
		{
			type: 'checkbox',
			id: 'enablePolling',
			label: 'Enable Status Polling',
			width: 6,
			default: true,
		},
		{
			type: 'number',
			id: 'pollInterval',
			label: 'Poll Interval (ms)',
			width: 6,
			default: 1000,
			min: 100,
			max: 10000,
		},
	]
}
