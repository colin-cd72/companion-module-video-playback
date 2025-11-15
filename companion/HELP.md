# Video Playback Companion Module

This module allows Bitfocus Companion to control a Video Playback player application via its HTTP API.

## Configuration

### Connection Settings
- **Target IP**: The IP address or hostname of the Video Playback application (default: localhost)
- **Target Port**: The HTTP API port of the Video Playback application (default: 8090)

### Polling Settings
- **Enable Status Polling**: Enable/disable automatic status updates from the player
- **Poll Interval**: How often to poll for status updates (in milliseconds, default: 1000ms)

## Available Actions

### Playback Control
- **Play Button**: Start playback of a specific button (1-999)
- **Stop Button**: Stop playback of a specific button
- **Toggle Button**: Toggle playback (play if stopped, stop if playing)
- **Pause Button**: Pause/resume playback of a specific button
- **Fade Button**: Fade out a playing button over a specified duration (0.1-30 seconds)
- **Stop All**: Stop all currently playing buttons

### Navigation
- **Change Page**: Switch to a different page (1-99)
- **Next Button**: Play the next button in sequence

### Media Control
- **Seek to Time**: Jump to a specific time in the media (in seconds)
- **Set Button Volume**: Set the volume for a specific button (0-200%)
- **Set Loop**: Turn loop on, off, or toggle for a specific button

### Output Window
- **Toggle Output Fullscreen**: Toggle fullscreen mode for the output window
- **Move Output to Screen**: Move the output window to a specific screen (0-10)

## Available Feedbacks

### Button State Feedbacks
- **Button Playing State**: Changes button color when a specific button is playing (default: green)
- **Button Fading State**: Changes button color when a specific button is fading (default: orange)
- **Button Paused State**: Changes button color when a specific button is paused (default: yellow)
- **Current Clip**: Feedback for the currently selected/playing clip (default: blue)

### Player Status Feedbacks
- **Player Status**: Feedback based on whether any clip is playing, stopped, or paused
- **Loop Status**: Feedback based on whether loop is enabled for a specific button (default: cyan)

## Available Variables

### Per-Button Variables (Buttons 1-128)
For each button, the following variables are available:
- `button_X_state`: Current state (playing, paused, stopped, fading)
- `button_X_label`: Button label/name
- `button_X_time`: Current playback time (MM:SS)
- `button_X_remaining`: Remaining time (MM:SS)
- `button_X_timecode`: Current timecode (HH:MM:SS:FF at 30fps)
- `button_X_timecode_hh/mm/ss/ff`: Individual timecode components
- `button_X_remaining_timecode`: Remaining timecode (HH:MM:SS:FF at 30fps)
- `button_X_remaining_hh/mm/ss/ff`: Individual remaining timecode components

### Global Variables (Currently Playing Clip)
- `clip_id`: Current clip ID (button number)
- `clip_name`: Current clip name (file name)
- `status`: Player status (playing, paused, stopped)
- `loop`: Loop status (on/off)
- `timecode`: Current timecode (HH:MM:SS:FF)
- `timecode_hh/mm/ss/ff`: Individual timecode components
- `remaining_timecode`: Remaining timecode (HH:MM:SS:FF)
- `remaining_hh/mm/ss/ff`: Individual remaining timecode components
- `current_page`: Current page number

## Available Presets

### Play Buttons (1-12)
Pre-configured buttons to play buttons 1-12 with playing/fading state feedback

### Toggle Buttons (1-12)
Pre-configured toggle buttons for buttons 1-12 with state feedback

### Stop Buttons (1-12)
Pre-configured stop buttons for buttons 1-12

### Fade Buttons (1-12)
Pre-configured fade buttons for buttons 1-12 (3-second fade)

### Page Navigation
Pre-configured buttons to navigate to pages 1-5

### Control Buttons
- Stop All: Stops all playing buttons
- Volume 50%: Sets button 1 volume to 50%
- Volume 100%: Sets button 1 volume to 100%

### Output Window Controls
- Toggle Fullscreen: Toggle output window fullscreen mode
- Move to Screen 1/2/3: Move output window to specific screens

## Requirements

- Video Playback application must be running with HTTP API enabled
- Video Playback API must be accessible at the configured IP and port
- Default API endpoint: http://localhost:8090

## Notes

- Button numbers are 1-indexed in Companion but may be 0-indexed in the API
- Timecode assumes 30fps for frame calculations
- Status polling can be disabled to reduce network traffic
- All HTTP requests include proper error handling and connection status updates
