# 🦁☀️ Lion and Sun - Psiphon Windows

A Windows desktop application providing the same protocol selection features as ShirOKhorshid (CDN fronting, conduit, direct, auto).

---

## 🦁☀️ درباره پروژه | About Project

**Lion and Sun** is a Windows client for Psiphon tunneling with advanced protocol selection options, based on the open-source Psiphon tunnel-core.

## Features

- Protocol Selection: Auto, Direct, CDN Fronting, Conduit
- Conduit Mode Selection: Auto, ShirOKhorshid, Public
- Custom CDN Fronting IP List
- Custom SNI for CDN Fronting
- Local Proxy (HTTP/SOCKS)
- Network Sharing
- Split Tunnel

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                    Electron UI                       │
│  (HTML/CSS/JS - Protocol Selection, Settings)        │
└──────────────────────────┬──────────────────────────┘
                           │ IPC
┌──────────────────────────▼──────────────────────────┐
│                  Node.js Backend                      │
│  - Protocol selection handling                       │
│  - Settings management                               │
│  - Psiphon CLI integration                           │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│              Psiphon Tunnel Core CLI                 │
│  (psiphon-tunnel-core.exe)                           │
│  - SSH, Obfuscated SSH, Meek                        │
│  - Fronted/Meek, CDN Fronting                       │
│  - Conduit tunneling                                 │
└─────────────────────────────────────────────────────┘
```

## Prerequisites

1. **Go 1.21+** - For building tunnel-core
2. **Node.js 18+** - For Electron UI
3. **npm** - Package management

## Building

### Step 1: Build Psiphon Tunnel Core

```bash
cd psiphon-tunnel-core/ConsoleClient
./make.bash windows
```

This creates `psiphon-tunnel-core-x86_64.exe` in the bin/windows directory.

### Step 2: Setup Electron App

```bash
cd psiphon-windows-app
npm install
npm run build
```

### Step 3: Run

```bash
npm start
```

## Protocol Configuration

The app passes these settings to tunnel-core:

| Mode | LimitTunnelProtocols |
|------|---------------------|
| Auto | [] (all protocols) |
| Direct | SSH, OSSH |
| CDN Fronting | FRONTED_MEEK, FRONTED_MEEK_HTTP, FRONTED_MEEK_QUIC_OBFUSCATED_SSH |
| Conduit | CONDUIT_OBFUSCATED_SSH |

## License

GPL-3.0 (same as Psiphon and ShirOKhorshid)