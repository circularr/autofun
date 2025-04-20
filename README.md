# auto.fun Token Tracker

A fun, experimental token tracker web app for the auto.fun ecosystem.

## Features
- View tokens with volume, market cap, holders, liquidity %, and more
- Sort and filter tokens
- Responsive charts for tokens created, unique creators, volume, market cap, and holders
- Mobile-optimized UI with compact columns
- Copy contract address and jump to token page

## Getting Started

### Prerequisites
- Node.js (v16 or later recommended)
- npm (comes with Node.js)

### Installation
1. Clone this repo:
   ```sh
   git clone https://github.com/circularr/autofun.git
   cd autofun
   ```
2. Install dependencies:
   ```sh
   npm install
   ```
3. Build the app:
   ```sh
   npm run build
   ```
4. Serve locally (optional):
   ```sh
   npm install -g serve
   serve -s build
   ```

## Usage
- Open the app in your browser after serving.
- Click table headers to sort.
- Use the chart tabs to switch between different data graphs.
- On mobile, the UI is extra compact.

## Notes
- This project is just for fun! No guarantees that it works perfectly or that the data is correct.
- Data is fetched from the [auto.fun API](https://api.auto.fun/api/tokens) and may change or break at any time.
- If you find a bug or want to improve it, PRs/issues are welcome.

## License
MIT

---

> No idea if it works, no idea if data is right, but fun!
