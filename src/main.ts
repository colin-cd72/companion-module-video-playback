import { InstanceBase, runEntrypoint, InstanceStatus, SomeCompanionConfigField } from '@companion-module/base'
import type {
	CompanionActionDefinitions,
	CompanionFeedbackDefinitions,
	CompanionPresetDefinitions,
	CompanionVariableDefinition,
	CompanionVariableValues,
	CompanionActionEvent,
	CompanionFeedbackContext,
	CompanionFeedbackButtonStyleResult,
	CompanionFeedbackBooleanEvent,
} from '@companion-module/base'
import fetch, { Response } from 'node-fetch'
import { ModuleConfig, getConfigFields } from './config.js'

interface ButtonStatus {
	state: 'playing' | 'paused' | 'fading' | 'stopped' | 'idle'
	label: string
	currentTime: number
	remaining: number
	isLooping: boolean
}

interface ButtonStatusMap {
	[buttonNumber: number]: ButtonStatus
}

interface ApiButton {
	buttonNumber: number
	state: 'playing' | 'paused' | 'fading' | 'stopped' | 'idle'
	label: string
	currentTime?: number
	remaining?: number
	duration?: number
	isLooping?: boolean
	gotoButtonNumber?: number
	gotoButtonLabel?: string
}

interface ApiStatusResponse {
	buttons: ApiButton[]
	currentPage?: number
}

interface TimeComponents {
	hh: string
	mm: string
	ss: string
	ff: string
}

class VideoPlaybackInstance extends InstanceBase<ModuleConfig> {
	public config: ModuleConfig = {
		host: 'localhost',
		port: '8090',
		enablePolling: true,
		pollInterval: 1000,
	}

	private pollInterval: NodeJS.Timeout | null = null
	private buttonStatus: ButtonStatusMap = {}

	constructor(internal: unknown) {
		super(internal)
	}

	async init(config: ModuleConfig): Promise<void> {
		this.config = config
		this.updateStatus(InstanceStatus.Ok)
		this.initActions()
		this.initFeedbacks()
		this.initVariables()
		this.initPresets()

		// Start polling for status if enabled
		if (this.config.enablePolling) {
			this.startPolling()
		}
	}

	async destroy(): Promise<void> {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}
	}

	async configUpdated(config: ModuleConfig): Promise<void> {
		this.config = config
		this.initActions()
		this.initFeedbacks()

		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}

		if (this.config.enablePolling) {
			this.startPolling()
		}
	}

	getConfigFields(): SomeCompanionConfigField[] {
		return getConfigFields()
	}

	initActions(): void {
		const actions: CompanionActionDefinitions = {
			playButton: {
				name: 'Play Button',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}` // Convert 1-indexed to 0-indexed
					await this.sendCommand(`/api/button/${buttonId}/play`, 'POST')
				},
			},
			stopButton: {
				name: 'Stop Button',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}` // Convert 1-indexed to 0-indexed
					await this.sendCommand(`/api/button/${buttonId}/stop`, 'POST')
				},
			},
			toggleButton: {
				name: 'Toggle Button',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}` // Convert 1-indexed to 0-indexed
					await this.sendCommand(`/api/button/${buttonId}/toggle`, 'POST')
				},
			},
			fadeButton: {
				name: 'Fade Button',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
					{
						type: 'number',
						label: 'Fade Duration (seconds)',
						id: 'duration',
						default: 3.0,
						min: 0.1,
						max: 30.0,
						step: 0.1,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}` // Convert 1-indexed to 0-indexed
					// Convert seconds to milliseconds
					const durationMs = (action.options.duration as number) * 1000
					await this.sendCommand(`/api/button/${buttonId}/fade`, 'POST', { duration: durationMs })
				},
			},
			changePage: {
				name: 'Change Page',
				options: [
					{
						type: 'number',
						label: 'Page Number',
						id: 'pageNumber',
						default: 1,
						min: 1,
						max: 99,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					await this.sendCommand(`/api/page/${action.options.pageNumber}`, 'POST')
				},
			},
			stopAll: {
				name: 'Stop All Buttons',
				options: [],
				callback: async (): Promise<void> => {
					await this.sendCommand('/api/stop-all', 'POST')
				},
			},
			gotoTime: {
				name: 'Seek to Time',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
					{
						type: 'number',
						label: 'Time (seconds)',
						id: 'seconds',
						default: 0,
						min: 0,
						max: 86400, // 24 hours
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}`
					await this.sendCommand(`/api/button/${buttonId}/goto/${action.options.seconds}`, 'POST')
				},
			},
			setVolume: {
				name: 'Set Button Volume',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
					{
						type: 'number',
						label: 'Volume (0-200%)',
						id: 'volume',
						default: 100,
						min: 0,
						max: 200,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}`
					const volumeValue = (action.options.volume as number) / 100 // Convert percentage to 0-2 range
					await this.sendCommand(`/api/button/${buttonId}/volume/${volumeValue}`, 'POST')
				},
			},
			toggleFullscreen: {
				name: 'Toggle Output Fullscreen',
				options: [],
				callback: async (): Promise<void> => {
					await this.sendCommand('/api/output/fullscreen', 'GET')
				},
			},
			moveOutputToScreen: {
				name: 'Move Output to Screen',
				options: [
					{
						type: 'number',
						label: 'Screen ID',
						id: 'screenId',
						default: 0,
						min: 0,
						max: 10,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					await this.sendCommand(`/api/output/move/${action.options.screenId}`, 'GET')
				},
			},
			pauseButton: {
				name: 'Pause Button',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}`
					await this.sendCommand(`/api/button/${buttonId}/pause`, 'POST')
				},
			},
			nextButton: {
				name: 'Next Button',
				description: 'Play the next button in sequence (wraps to button 1 after last)',
				options: [],
				callback: async (): Promise<void> => {
					await this.sendCommand('/api/next', 'POST')
				},
			},
			selectClip: {
				name: 'Select Clip',
				description: 'Select and play a specific clip/button',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}`
					await this.sendCommand(`/api/button/${buttonId}/play`, 'POST')
				},
			},
			setLoop: {
				name: 'Set Loop',
				description: 'Turn loop on, off, or toggle for a button',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
					{
						type: 'dropdown',
						label: 'Loop Mode',
						id: 'mode',
						default: 'toggle',
						choices: [
							{ id: 'on', label: 'Loop On' },
							{ id: 'off', label: 'Loop Off' },
							{ id: 'toggle', label: 'Toggle Loop' },
						],
					},
				],
				callback: async (action: CompanionActionEvent): Promise<void> => {
					const buttonNumber = Number(action.options.buttonNumber)
					const buttonId = `button-${buttonNumber - 1}`
					await this.sendCommand(`/api/button/${buttonId}/loop/${action.options.mode}`, 'POST')
				},
			},
		}
		this.setActionDefinitions(actions)
	}

	initFeedbacks(): void {
		const feedbacks: CompanionFeedbackDefinitions = {
			buttonState: {
				type: 'boolean',
				name: 'Button Playing State',
				description: 'Change button color when button is playing',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				defaultStyle: {
					bgcolor: 0x00ff00,
					color: 0x000000,
				},
				callback: (feedback: CompanionFeedbackBooleanEvent, context: CompanionFeedbackContext): boolean => {
					const buttonNum = feedback.options.buttonNumber as number
					const status = this.buttonStatus?.[buttonNum]
					return status?.state === 'playing'
				},
			},
			buttonFading: {
				type: 'boolean',
				name: 'Button Fading State',
				description: 'Change button color when button is fading',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				defaultStyle: {
					bgcolor: 0xffaa00,
					color: 0x000000,
				},
				callback: (feedback: CompanionFeedbackBooleanEvent, context: CompanionFeedbackContext): boolean => {
					const buttonNum = feedback.options.buttonNumber as number
					const status = this.buttonStatus?.[buttonNum]
					return status?.state === 'fading'
				},
			},
			buttonPaused: {
				type: 'boolean',
				name: 'Button Paused State',
				description: 'Change button color when button is paused',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				defaultStyle: {
					bgcolor: 0xffff00,
					color: 0x000000,
				},
				callback: (feedback: CompanionFeedbackBooleanEvent, context: CompanionFeedbackContext): boolean => {
					const buttonNum = feedback.options.buttonNumber as number
					const status = this.buttonStatus?.[buttonNum]
					return status?.state === 'paused'
				},
			},
			currentClip: {
				type: 'boolean',
				name: 'Current Clip',
				description: 'Feedback for the currently selected/playing clip',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
				],
				defaultStyle: {
					bgcolor: 0x0000ff,
					color: 0xffffff,
				},
				callback: (feedback: CompanionFeedbackBooleanEvent, context: CompanionFeedbackContext): boolean => {
					const buttonNum = feedback.options.buttonNumber as number
					// Check if this button is currently playing
					const status = this.buttonStatus?.[buttonNum]
					return status !== undefined && (status.state === 'playing' || status.state === 'paused')
				},
			},
			playerStatus: {
				type: 'boolean',
				name: 'Player Status',
				description: 'Feedback based on whether any clip is playing, stopped or paused',
				options: [
					{
						type: 'dropdown',
						label: 'Status',
						id: 'status',
						default: 'playing',
						choices: [
							{ id: 'playing', label: 'Playing' },
							{ id: 'paused', label: 'Paused' },
							{ id: 'stopped', label: 'Stopped' },
						],
					},
				],
				defaultStyle: {
					bgcolor: 0x00ff00,
					color: 0x000000,
				},
				callback: (feedback: CompanionFeedbackBooleanEvent, context: CompanionFeedbackContext): boolean => {
					const targetStatus = feedback.options.status as string

					if (!this.buttonStatus) return false

					// Check if any button matches the target status
					const hasStatus = Object.values(this.buttonStatus).some((status) => status.state === targetStatus)

					// For stopped, check if NO buttons are playing or paused
					if (targetStatus === 'stopped') {
						return Object.values(this.buttonStatus).every(
							(status) => status.state !== 'playing' && status.state !== 'paused'
						)
					}

					return hasStatus
				},
			},
			loopStatus: {
				type: 'boolean',
				name: 'Loop Status',
				description: 'Feedback based on whether loop is enabled for a button',
				options: [
					{
						type: 'number',
						label: 'Button Number',
						id: 'buttonNumber',
						default: 1,
						min: 1,
						max: 999,
					},
					{
						type: 'dropdown',
						label: 'Loop Setting',
						id: 'loopSetting',
						default: 'on',
						choices: [
							{ id: 'on', label: 'Loop On' },
							{ id: 'off', label: 'Loop Off' },
						],
					},
				],
				defaultStyle: {
					bgcolor: 0x00ffff,
					color: 0x000000,
				},
				callback: (feedback: CompanionFeedbackBooleanEvent, context: CompanionFeedbackContext): boolean => {
					const buttonNum = feedback.options.buttonNumber as number
					const status = this.buttonStatus?.[buttonNum]

					if (!status) return false

					const isLooping = status.isLooping || false
					const targetLoop = feedback.options.loopSetting === 'on'

					return isLooping === targetLoop
				},
			},
		}
		this.setFeedbackDefinitions(feedbacks)
	}

	initVariables(): void {
		const variables: CompanionVariableDefinition[] = []

		// Per-button variables (0-indexed for compatibility)
		for (let i = 0; i < 128; i++) {
			// Asset/filename variables (0-indexed like asset_name_0, asset_name_1, etc.)
			variables.push({
				variableId: `asset_name_${i}`,
				name: `Asset ${i} Filename`,
			})
			variables.push({
				variableId: `asset_${i}_timecode`,
				name: `Asset ${i} Timecode (HH:MM:SS:FF)`,
			})
			variables.push({
				variableId: `asset_${i}_remaining`,
				name: `Asset ${i} Remaining (HH:MM:SS:FF)`,
			})
			variables.push({
				variableId: `asset_${i}_state`,
				name: `Asset ${i} State`,
			})
		}

		// Per-button variables (1-indexed for user-friendly access)
		for (let i = 1; i <= 128; i++) {
			variables.push({
				variableId: `button_${i}_state`,
				name: `Button ${i} State`,
			})
			variables.push({
				variableId: `button_${i}_label`,
				name: `Button ${i} Label`,
			})
			variables.push({
				variableId: `button_${i}_time`,
				name: `Button ${i} Current Time (MM:SS)`,
			})
			variables.push({
				variableId: `button_${i}_remaining`,
				name: `Button ${i} Remaining Time (MM:SS)`,
			})
			variables.push({
				variableId: `button_${i}_timecode`,
				name: `Button ${i} Timecode (HH:MM:SS:FF)`,
			})
			variables.push({
				variableId: `button_${i}_timecode_hh`,
				name: `Button ${i} Timecode Hours`,
			})
			variables.push({
				variableId: `button_${i}_timecode_mm`,
				name: `Button ${i} Timecode Minutes`,
			})
			variables.push({
				variableId: `button_${i}_timecode_ss`,
				name: `Button ${i} Timecode Seconds`,
			})
			variables.push({
				variableId: `button_${i}_timecode_ff`,
				name: `Button ${i} Timecode Frames`,
			})
			variables.push({
				variableId: `button_${i}_remaining_timecode`,
				name: `Button ${i} Remaining Timecode (HH:MM:SS:FF)`,
			})
			variables.push({
				variableId: `button_${i}_remaining_hh`,
				name: `Button ${i} Remaining Hours`,
			})
			variables.push({
				variableId: `button_${i}_remaining_mm`,
				name: `Button ${i} Remaining Minutes`,
			})
			variables.push({
				variableId: `button_${i}_remaining_ss`,
				name: `Button ${i} Remaining Seconds`,
			})
			variables.push({
				variableId: `button_${i}_remaining_ff`,
				name: `Button ${i} Remaining Frames`,
			})
		}

		// Global variables (for currently playing clip)
		variables.push({
			variableId: 'clip_id',
			name: 'Current Clip ID (Button Number)',
		})
		variables.push({
			variableId: 'clip_name',
			name: 'Current Clip Name (File Name)',
		})
		variables.push({
			variableId: 'status',
			name: 'Player Status',
		})
		variables.push({
			variableId: 'loop',
			name: 'Loop Status',
		})
		variables.push({
			variableId: 'timecode',
			name: 'Current Timecode (HH:MM:SS:FF)',
		})
		variables.push({
			variableId: 'timecode_hh',
			name: 'Timecode Hours',
		})
		variables.push({
			variableId: 'timecode_mm',
			name: 'Timecode Minutes',
		})
		variables.push({
			variableId: 'timecode_ss',
			name: 'Timecode Seconds',
		})
		variables.push({
			variableId: 'timecode_ff',
			name: 'Timecode Frames',
		})
		variables.push({
			variableId: 'remaining_timecode',
			name: 'Remaining Timecode (HH:MM:SS:FF)',
		})
		variables.push({
			variableId: 'remaining_hh',
			name: 'Remaining Hours',
		})
		variables.push({
			variableId: 'remaining_mm',
			name: 'Remaining Minutes',
		})
		variables.push({
			variableId: 'remaining_ss',
			name: 'Remaining Seconds',
		})
		variables.push({
			variableId: 'remaining_ff',
			name: 'Remaining Frames',
		})
		variables.push({
			variableId: 'current_page',
			name: 'Current Page',
		})
		variables.push({
			variableId: 'next_clip_id',
			name: 'Next Clip ID (Button Number)',
		})
		variables.push({
			variableId: 'next_clip_name',
			name: 'Next Clip Name (File Name)',
		})

		this.setVariableDefinitions(variables)
	}

	initPresets(): void {
		const presets: CompanionPresetDefinitions = {}

		for (let i = 1; i <= 12; i++) {
			presets[`play_button_${i}`] = {
				type: 'button',
				category: 'Play Buttons',
				name: `Play Button ${i}`,
				style: {
					text: `Play ${i}`,
					size: '18',
					color: 0xffffff,
					bgcolor: 0x000000,
				},
				steps: [
					{
						down: [
							{
								actionId: 'playButton',
								options: {
									buttonNumber: i,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'buttonState',
						options: {
							buttonNumber: i,
						},
					},
					{
						feedbackId: 'buttonFading',
						options: {
							buttonNumber: i,
						},
					},
				],
			}

			presets[`toggle_button_${i}`] = {
				type: 'button',
				category: 'Toggle Buttons',
				name: `Toggle Button ${i}`,
				style: {
					text: `${i}`,
					size: '18',
					color: 0xffffff,
					bgcolor: 0x000000,
				},
				steps: [
					{
						down: [
							{
								actionId: 'toggleButton',
								options: {
									buttonNumber: i,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [
					{
						feedbackId: 'buttonState',
						options: {
							buttonNumber: i,
						},
					},
					{
						feedbackId: 'buttonFading',
						options: {
							buttonNumber: i,
						},
					},
				],
			}

			presets[`stop_button_${i}`] = {
				type: 'button',
				category: 'Stop Buttons',
				name: `Stop Button ${i}`,
				style: {
					text: `Stop ${i}`,
					size: '14',
					color: 0xffffff,
					bgcolor: 0xff0000,
				},
				steps: [
					{
						down: [
							{
								actionId: 'stopButton',
								options: {
									buttonNumber: i,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}

			presets[`fade_button_${i}`] = {
				type: 'button',
				category: 'Fade Buttons',
				name: `Fade Button ${i}`,
				style: {
					text: `Fade ${i}`,
					size: '14',
					color: 0x000000,
					bgcolor: 0xffaa00,
				},
				steps: [
					{
						down: [
							{
								actionId: 'fadeButton',
								options: {
									buttonNumber: i,
									duration: 3.0,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}
		}

		// Page navigation presets
		for (let i = 1; i <= 5; i++) {
			presets[`page_${i}`] = {
				type: 'button',
				category: 'Page Navigation',
				name: `Go to Page ${i}`,
				style: {
					text: `Page ${i}`,
					size: '18',
					color: 0x00ff00,
					bgcolor: 0x000000,
				},
				steps: [
					{
						down: [
							{
								actionId: 'changePage',
								options: {
									pageNumber: i,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}
		}

		// Stop all preset
		presets['stop_all'] = {
			type: 'button',
			category: 'Control',
			name: 'Stop All',
			style: {
				text: 'STOP\\nALL',
				size: '18',
				color: 0xffffff,
				bgcolor: 0xaa0000,
			},
			steps: [
				{
					down: [
						{
							actionId: 'stopAll',
							options: {},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Volume control presets
		presets['volume_50'] = {
			type: 'button',
			category: 'Control',
			name: 'Volume 50%',
			style: {
				text: 'VOL\\n50%',
				size: '14',
				color: 0xffffff,
				bgcolor: 0x333333,
			},
			steps: [
				{
					down: [
						{
							actionId: 'setVolume',
							options: {
								buttonNumber: 1,
								volume: 50,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		presets['volume_100'] = {
			type: 'button',
			category: 'Control',
			name: 'Volume 100%',
			style: {
				text: 'VOL\\n100%',
				size: '14',
				color: 0xffffff,
				bgcolor: 0x555555,
			},
			steps: [
				{
					down: [
						{
							actionId: 'setVolume',
							options: {
								buttonNumber: 1,
								volume: 100,
							},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Output window presets
		presets['toggle_fullscreen'] = {
			type: 'button',
			category: 'Output Window',
			name: 'Toggle Fullscreen',
			style: {
				text: 'FULL\\nSCREEN',
				size: '14',
				color: 0x000000,
				bgcolor: 0x00aaff,
			},
			steps: [
				{
					down: [
						{
							actionId: 'toggleFullscreen',
							options: {},
						},
					],
					up: [],
				},
			],
			feedbacks: [],
		}

		// Screen selection presets
		for (let i = 0; i <= 2; i++) {
			presets[`screen_${i + 1}`] = {
				type: 'button',
				category: 'Output Window',
				name: `Move to Screen ${i + 1}`,
				style: {
					text: `Screen\\n${i + 1}`,
					size: '14',
					color: 0xffffff,
					bgcolor: 0x0066aa,
				},
				steps: [
					{
						down: [
							{
								actionId: 'moveOutputToScreen',
								options: {
									screenId: i,
								},
							},
						],
						up: [],
					},
				],
				feedbacks: [],
			}
		}

		this.setPresetDefinitions(presets)
	}

	async sendCommand(path: string, method: string = 'GET', body: Record<string, unknown> | null = null): Promise<unknown> {
		const url = `http://${this.config.host}:${this.config.port}${path}`

		try {
			const options: Record<string, unknown> = {
				method: method,
				headers: {
					'Content-Type': 'application/json',
				},
			}

			if (body) {
				options.body = JSON.stringify(body)
			}

			const response: Response = await fetch(url, options as any)

			if (!response.ok) {
				this.log('error', `HTTP Error: ${response.status} ${response.statusText}`)
				this.updateStatus(InstanceStatus.UnknownWarning, `HTTP Error: ${response.status}`)
			} else {
				this.updateStatus(InstanceStatus.Ok)
			}

			return await response.json()
		} catch (err) {
			const error = err as Error
			this.log('error', `Network error: ${error.message}`)
			this.updateStatus(InstanceStatus.ConnectionFailure, error.message)
		}
	}

	startPolling(): void {
		if (this.pollInterval) {
			clearInterval(this.pollInterval)
		}

		this.pollInterval = setInterval(() => {
			this.pollStatus()
		}, this.config.pollInterval || 1000)

		// Poll immediately
		this.pollStatus()
	}

	async pollStatus(): Promise<void> {
		try {
			const status = (await this.sendCommand('/api/status', 'GET')) as ApiStatusResponse

			if (status && status.buttons) {
				this.buttonStatus = {}
				let currentlyPlaying: ApiButton | null = null

				// Helper functions for time formatting
				const formatTime = (seconds: number): string => {
					const mins = Math.floor(seconds / 60)
					const secs = Math.floor(seconds % 60)
					return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
				}

				const formatTimecode = (seconds: number): string => {
					const hours = Math.floor(seconds / 3600)
					const mins = Math.floor((seconds % 3600) / 60)
					const secs = Math.floor(seconds % 60)
					const frames = Math.floor((seconds % 1) * 30) // Assuming 30fps
					// Compact format: only show hours/minutes if non-zero
					if (hours > 0) {
						return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs
							.toString()
							.padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
					} else if (mins > 0) {
						return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames
							.toString()
							.padStart(2, '0')}`
					} else {
						return `${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`
					}
				}

				const getTimecodeComponents = (seconds: number): TimeComponents => {
					return {
						hh: Math.floor(seconds / 3600)
							.toString()
							.padStart(2, '0'),
						mm: Math.floor((seconds % 3600) / 60)
							.toString()
							.padStart(2, '0'),
						ss: Math.floor(seconds % 60)
							.toString()
							.padStart(2, '0'),
						ff: Math.floor((seconds % 1) * 30)
							.toString()
							.padStart(2, '0'), // 30fps
					}
				}

				// Process button status
				status.buttons.forEach((button) => {
					const buttonNum = button.buttonNumber
					this.buttonStatus[buttonNum] = {
						state: button.state,
						label: button.label,
						currentTime: button.currentTime || 0,
						remaining: button.remaining || 0,
						isLooping: button.isLooping || false,
					}

					// Track first playing button for global variables
					if (!currentlyPlaying && (button.state === 'playing' || button.state === 'paused')) {
						currentlyPlaying = button
					}

					const current = button.currentTime || 0
					const remaining = button.remaining || 0
					const currentTC = getTimecodeComponents(current)
					const remainingTC = getTimecodeComponents(remaining)

					// Update per-button variables (1-indexed)
					const buttonVariables: CompanionVariableValues = {
						[`button_${buttonNum}_state`]: button.state || 'idle',
						[`button_${buttonNum}_label`]: button.label || '',
						[`button_${buttonNum}_time`]: formatTime(current),
						[`button_${buttonNum}_remaining`]: formatTime(remaining),
						[`button_${buttonNum}_timecode`]: formatTimecode(current),
						[`button_${buttonNum}_timecode_hh`]: currentTC.hh,
						[`button_${buttonNum}_timecode_mm`]: currentTC.mm,
						[`button_${buttonNum}_timecode_ss`]: currentTC.ss,
						[`button_${buttonNum}_timecode_ff`]: currentTC.ff,
						[`button_${buttonNum}_remaining_timecode`]: formatTimecode(remaining),
						[`button_${buttonNum}_remaining_hh`]: remainingTC.hh,
						[`button_${buttonNum}_remaining_mm`]: remainingTC.mm,
						[`button_${buttonNum}_remaining_ss`]: remainingTC.ss,
						[`button_${buttonNum}_remaining_ff`]: remainingTC.ff,
					}
					this.setVariableValues(buttonVariables)

					// Update asset variables (0-indexed for compatibility)
					const assetIndex = buttonNum - 1
					const assetVariables: CompanionVariableValues = {
						[`asset_name_${assetIndex}`]: button.label || '',
						[`asset_${assetIndex}_timecode`]: formatTimecode(current),
						[`asset_${assetIndex}_remaining`]: formatTimecode(remaining),
						[`asset_${assetIndex}_state`]: button.state || 'idle',
					}
					this.setVariableValues(assetVariables)
				})

				// Update global variables (for currently playing clip)
				if (currentlyPlaying) {
					const playing: ApiButton = currentlyPlaying
					const current = playing.currentTime || 0
					const remaining = playing.remaining || 0
					const currentTC = getTimecodeComponents(current)
					const remainingTC = getTimecodeComponents(remaining)

					const globalVariables: CompanionVariableValues = {
						clip_id: playing.buttonNumber,
						clip_name: playing.label || '',
						status: playing.state,
						loop: playing.isLooping ? 'on' : 'off',
						timecode: formatTimecode(current),
						timecode_hh: currentTC.hh,
						timecode_mm: currentTC.mm,
						timecode_ss: currentTC.ss,
						timecode_ff: currentTC.ff,
						remaining_timecode: formatTimecode(remaining),
						remaining_hh: remainingTC.hh,
						remaining_mm: remainingTC.mm,
						remaining_ss: remainingTC.ss,
						remaining_ff: remainingTC.ff,
						next_clip_id: playing.gotoButtonNumber || '',
						next_clip_name: playing.gotoButtonLabel || '',
					}
					this.setVariableValues(globalVariables)
				} else {
					// No clip playing - clear global variables
					const emptyVariables: CompanionVariableValues = {
						clip_id: '',
						clip_name: '',
						status: 'stopped',
						loop: 'off',
						timecode: '00:00:00:00',
						timecode_hh: '00',
						timecode_mm: '00',
						timecode_ss: '00',
						timecode_ff: '00',
						remaining_timecode: '00:00:00:00',
						remaining_hh: '00',
						remaining_mm: '00',
						remaining_ss: '00',
						remaining_ff: '00',
						next_clip_id: '',
						next_clip_name: '',
					}
					this.setVariableValues(emptyVariables)
				}

				// Update current page
				if (status.currentPage !== undefined) {
					this.setVariableValues({
						current_page: status.currentPage + 1, // +1 for 1-indexed display
					})
				}

				// Check all feedbacks
				this.checkFeedbacks(
					'buttonState',
					'buttonFading',
					'buttonPaused',
					'currentClip',
					'playerStatus',
					'loopStatus'
				)
			}
		} catch (err) {
			const error = err as Error
			this.log('debug', `Poll error: ${error.message}`)
		}
	}
}

export = VideoPlaybackInstance
runEntrypoint(VideoPlaybackInstance, [])
