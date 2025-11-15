# companion-module-video-playback

Bitfocus Companion module for Video Playback player

## Description

This module allows you to control the Video Playback application from Bitfocus Companion. It provides full control over video playback, including play, stop, fade, and page navigation.

## Configuration

- **Target IP**: The IP address of the machine running Video Playback (default: localhost)
- **Target Port**: The API port of Video Playback (default: 8090)
- **Enable Status Polling**: Enable/disable automatic status polling
- **Poll Interval**: How often to poll for status updates (in milliseconds)

## Available Actions

### Playback Control
- **Play Button** - Play a specific button by number
- **Stop Button** - Stop a specific button by number
- **Toggle Button** - Toggle play/stop for a specific button
- **Fade Button** - Fade out a specific button over a specified duration (0.1-30 seconds)
- **Seek to Time** - Jump to a specific timestamp in a playing video (0-86400 seconds)
- **Set Button Volume** - Adjust volume for a specific button (0-200%)

### Navigation
- **Change Page** - Switch to a different page
- **Stop All** - Stop all currently playing buttons

### Output Window Control
- **Toggle Output Fullscreen** - Toggle fullscreen mode for the output window
- **Move Output to Screen** - Move the output window to a specific screen (0-10)

## Feedbacks

- **Button Playing State** - Changes button color (green) when a button is playing
- **Button Fading State** - Changes button color (orange) when a button is fading

## Variables

For each button (1-128):
- `button_X_state` - Current playback state (idle, playing, paused, fading, stopping)
- `button_X_label` - Button label
- `button_X_time` - Current playback time (MM:SS)
- `button_X_remaining` - Remaining playback time (MM:SS)

Global:
- `current_page` - Current page number

## Presets

### Play Buttons (1-12)
Buttons that play the corresponding button number with visual feedback

### Toggle Buttons (1-12)
Buttons that toggle play/stop for the corresponding button number

### Stop Buttons (1-12)
Red buttons that stop the corresponding button number

### Fade Buttons (1-12)
Orange buttons that fade out the corresponding button number (3 second default)

### Page Navigation (1-5)
Buttons to switch between pages 1-5

### Control
- **Stop All** - Emergency stop button for all playback
- **Volume 50%** - Set button 1 volume to 50%
- **Volume 100%** - Set button 1 volume to 100%

### Output Window
- **Toggle Fullscreen** - Toggle fullscreen mode
- **Move to Screen 1-3** - Quick buttons to move output to different screens

## API Requirements

This module requires the Video Playback application to have the API enabled (Settings > API > Enable API).

The module expects the following API endpoints:

**Playback Control:**
- `POST /api/button/{buttonId}/play` - Play a button
- `POST /api/button/{buttonId}/stop` - Stop a button
- `POST /api/button/{buttonId}/toggle` - Toggle a button
- `POST /api/button/{buttonId}/fade` - Fade a button (body: `{ duration: number }`)
- `POST /api/button/{buttonId}/goto/{seconds}` - Seek to timestamp
- `POST /api/button/{buttonId}/volume/{volume}` - Set volume (0-2)
- `POST /api/stop-all` - Stop all playing buttons

**Status & Info:**
- `GET /api/status` - Get current status of all buttons
- `GET /api/button/{buttonId}/currentTime` - Get current playback position
- `GET /api/ping` - Health check (returns "pong")

**Page Navigation:**
- `POST /api/page/{pageNumber}` - Change to a specific page

**Output Window Control:**
- `GET /api/output/fullscreen` - Toggle fullscreen mode
- `GET /api/output/move/{screenId}` - Move output to screen
- `GET /api/output/position/{x}/{y}/{width}/{height}` - Position/resize output window

## Installation

1. Copy this module folder to your Companion modules directory
2. Run `npm install` in the module directory
3. Restart Companion
4. Add a new "Video Playback" instance in Companion
5. Configure the IP address and port to match your Video Playback application

## Version History

### 1.0.0
- Initial release
- Play, Stop, Toggle, and Fade actions
- Page navigation
- Stop all functionality
- Status polling with feedbacks
- Variables for button state and timing
- Preset buttons for quick setup

## License

MIT

## Author

Colin DeFord
