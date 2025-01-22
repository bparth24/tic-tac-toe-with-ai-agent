# Tic-Tac-Toe with AI Agent

This project implements a Tic-Tac-Toe game where you can play against an AI agent. The AI agent is built using the Coinbase Developer Platform (CDP) AgentKit and Twitter AgentKit, and it can interact on-chain and with Twitter.

## Features

- Play Tic-Tac-Toe against an AI agent.
- Request 20 USDC faucet funds as a reward for winning the game.
- Tweet about your victory.

## Project Structure

The project directory is structured as follows:

````sh
tic-tac-toe-with-ai-agent/
├── node_modules/        # Node.js dependencies
├── src/                 # Source code
│   ├── agents/          # AI agent logic
│   │   └── startAgent.ts # Main entry point
│   └── utils/           # Utility functions
│       ├── initialization.ts
│       └── ticTacToeTool.ts
├── .gitignore           # Git ignore file
├── package.json         # Project metadata and dependencies
├── README.md            # Project documentation
├── secrets.json         # API keys and secrets (not included in version control)
├── tsconfig.json        # TypeScript configuration
└── wallet_data.txt      # Wallet data

## Getting Started

### Prerequisites

- Node.js
- npm

### Installation

1. Clone the repository:

   ```sh
   git clone `https://github.com/bparth24/tic-tac-toe-with-ai-agent.git`
   cd tic-tac-toe-with-ai-agent
   ```

2. Install dependencies:

   ```sh
   npm install
   ```

3. Create a [secrets.json] file in the root directory with the following content:

   ```json
   {
     "CDP_API_KEY_NAME": "your_cdp_api_key_name",
     "CDP_API_KEY_PRIVATE_KEY": "your_cdp_api_key_private_key",
     "NETWORK_ID": "base-sepolia",
     "OPENAI_API_KEY": "your_openai_api_key",
     "TWITTER_CLIENT_ID": "your_twitter_client_id",
     "TWITTER_OAUTH2_CLIENT_SECRET": "your_twitter_oauth2_client_secret",
     "TWITTER_ACCESS_TOKEN": "your_twitter_access_token",
     "TWITTER_ACCESS_TOKEN_SECRET": "your_twitter_access_token_secret",
     "TWITTER_API_KEY": "your_twitter_api_key",
     "TWITTER_API_SECRET": "your_twitter_api_secret",
     "TWITTER_BEARER_TOKEN": "your_twitter_bearer_token"
   }
   ```

### Running the Project

To start the agent, run:

```sh
npm start
```
````
