# EWS Concept New

This project is a **SvelteKit**-based front-end application for an Earthquake Early Warning System (EWS).

## Prerequisites
Before running this project, ensure you have installed:
- [Node.js](https://nodejs.org/) (version 18 or newer is recommended)
- [pnpm](https://pnpm.io/) (this project uses `pnpm` as the package manager, as indicated by `pnpm-lock.yaml`)

## Setup and Running the Project

1. **Open the project directory**:
   Make sure you are inside the project folder:
   ```bash
   cd ews-concept-new
   ```

2. **Install dependencies**:
   Run the following command to install all required packages:
   ```bash
   pnpm install
   ```
   *(Note: You can also use `npm install` if you don't have `pnpm` installed)*

3. **Environment Configuration**:
   Copy the `.env.example` configuration file to `.env`.
   
   For Windows (Command Prompt/PowerShell):
   ```cmd
   copy .env.example .env
   ```
   
   For Mac/Linux:
   ```bash
   cp .env.example .env
   ```
   
   Open the newly created `.env` file and adjust the WebSocket or Socket Server URLs if necessary:
   ```env
   # WebSocket Server URL for real-time seismic data
   # https://github.com/bagusindrayana/seedlink-websocket
   PUBLIC_WEBSOCKET_URL=ws://localhost:8080

   # Socket Server for earthquake/tsunami data
   # https://github.com/bagusindrayana/ews-socket
   PUBLIC_SOCKET_DATA_URL=ws://localhost:8081
   ```

4. **Run the Development Server**:
   Start the local development server with the command:
   ```bash
   pnpm run dev
   ```
   Or start it and automatically open a new tab in your browser:
   ```bash
   pnpm run dev --open
   ```
   By default, the application will run at `http://localhost:5173`.

## Building for Production

To create a production version of your app (a compiled version ready for deployment):

```bash
pnpm run build
```

You can preview the production build by running:
```bash
pnpm run preview
```

## Data Sources

This application relies on two distinct external data sources for real-time operation and alert notifications. These sources are configured via the `.env` file.

### 1. Seedlink WebSocket (Real-time Seismic Data)
- **Repository**: [seedlink-websocket](https://github.com/bagusindrayana/seedlink-websocket)
- **Purpose**: Provides streaming, real-time seismic waveform data (e.g., MiniSEED format).
- **Usage**: Used to render live seismograms and waveform charts on the front-end dashboard.
- **Environment Variable**: `PUBLIC_WEBSOCKET_URL` (default: `ws://localhost:8080`)

### 2. EWS Socket (Earthquake & Tsunami Alerts)
- **Repository**: [ews-socket](https://github.com/bagusindrayana/ews-socket)
- **Purpose**: A WebSocket server that broadcasts structured alert data regarding recent earthquakes, parameters (magnitude, depth, location), and potential tsunami warnings.
- **Usage**: Triggers the UI popups, updates the recent earthquake list, and displays alert banners.
- **Environment Variable**: `PUBLIC_SOCKET_DATA_URL` (default: `ws://localhost:8081`)


## Support Me!
[![Support me on Sociabuzz](https://img.shields.io/badge/Support%20Me-Sociabuzz-orange?style=for-the-badge&logo=buymeacoffee&logoColor=white)](https://sociabuzz.com/bagusindrayana/tribe)
