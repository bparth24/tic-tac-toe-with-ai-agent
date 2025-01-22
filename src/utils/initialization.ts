import { CdpAgentkit } from "@coinbase/cdp-agentkit-core";
import { CdpToolkit } from "@coinbase/cdp-langchain";
import { TwitterAgentkit } from "@coinbase/cdp-agentkit-core";
import { TwitterToolkit } from "@coinbase/twitter-langchain";
import { ChatOpenAI } from "@langchain/openai";
import { MemorySaver } from "@langchain/langgraph";
import { createReactAgent } from "@langchain/langgraph/prebuilt";
import { createTicTacToeTool } from "../utils/ticTacToeTool";
import * as fs from "fs";

// Load environment variables from secrets.json
process.env = JSON.parse(fs.readFileSync("secrets.json", "utf8"));

/**
 * Validates that required environment variables are set
 *
 * @throws {Error} - If required environment variables are missing
 * @returns {void}
 */
function validateEnvironment(): void {
  const missingVars: string[] = [];

  // Check required variables
  const requiredVars = [
    "OPENAI_API_KEY",
    "CDP_API_KEY_NAME",
    "CDP_API_KEY_PRIVATE_KEY",
    "TWITTER_ACCESS_TOKEN",
    "TWITTER_ACCESS_TOKEN_SECRET",
    "TWITTER_API_KEY",
    "TWITTER_API_SECRET",
    "TWITTER_BEARER_TOKEN",
  ];
  requiredVars.forEach((varName) => {
    if (!process.env[varName]) {
      missingVars.push(varName);
    }
  });

  // Exit if any required variables are missing
  if (missingVars.length > 0) {
    console.error("Error: Required environment variables are not set");
    missingVars.forEach((varName) => {
      console.error(`${varName}=your_${varName.toLowerCase()}_here`);
    });
    process.exit(1);
  }

  // Warn about optional NETWORK_ID
  if (!process.env.NETWORK_ID) {
    console.warn(
      "Warning: NETWORK_ID not set, defaulting to base-sepolia testnet"
    );
  }
}

// Add this right after imports and before any other code
validateEnvironment();

/**
 * Initialize the agent with CDP and Twitter Agentkits
 * Returns Agent executor and config
 * @returns {Promise<{ agent: any, config: any }>}
 */
export async function initializeAgent() {
  validateEnvironment();

  // Initialize LLM
  const llm = new ChatOpenAI({
    model: "gpt-4o-mini",
  });

  // Configure a file to persist the agent's CDP MPC Wallet Data
  const WALLET_DATA_FILE = "wallet_data.txt";
  let walletDataStr: string | null = null;

  // Read existing wallet data if available
  if (fs.existsSync(WALLET_DATA_FILE)) {
    try {
      walletDataStr = fs.readFileSync(WALLET_DATA_FILE, "utf8");
    } catch (error) {
      console.error("Error reading wallet data:", error);
      // Continue without wallet data
    }
  }

  // Configure CDP Agentkit
  const cdpConfig = {
    cdpWalletData: walletDataStr || undefined,
    networkId: process.env.NETWORK_ID || "base-sepolia",
  };

  // Initialize CDP Agentkit
  const cdpAgentkit = await CdpAgentkit.configureWithWallet(cdpConfig);

  // Initialize CDP Toolkit and get tools
  const cdpToolkit = new CdpToolkit(cdpAgentkit);
  const cdpTools = cdpToolkit.getTools();

  // Configure Twitter AgentKit
  const twitterConfig = {
    apiKey: process.env.TWITTER_API_KEY as string,
    apiSecret: process.env.TWITTER_API_SECRET as string,
    accessToken: process.env.TWITTER_ACCESS_TOKEN as string,
    accessTokenSecret: process.env.TWITTER_ACCESS_TOKEN_SECRET as string,
  };

  // Initialize Twitter Agentkit
  const twitterAgentkit = new TwitterAgentkit(twitterConfig);

  // Initialize Twitter Toolkit and get tools
  const twitterToolkit = new TwitterToolkit(twitterAgentkit);
  const twitterTools = twitterToolkit.getTools();

  // Add the Tic-Tac-Toe tool
  const ticTacToeTool = await createTicTacToeTool(
    cdpAgentkit,
    llm,
    twitterToolkit,
    cdpToolkit
  );
  cdpTools.push(ticTacToeTool);

  // Combine tools from both toolkits
  const tools = [...cdpTools, ...twitterTools];

  // Store buffered conversation history in memory
  const memory = new MemorySaver();
  const agentConfig = {
    configurable: { thread_id: "CDP & Twitter AgentKit Chatbot Example!" },
  };

  // Create React Agent using the LLM and combined tools
  const agent = createReactAgent({
    llm,
    tools,
    checkpointSaver: memory,
    messageModifier:
      "You are a helpful agent that can play a Tic-Tac-Toe Game with an agent, interact onchain using the Coinbase Developer Platform AgentKit and with Twitter (X) using the Twitter Agentkit!!",
  });

  // Save wallet data
  const exportedWallet = await cdpAgentkit.exportWallet();
  fs.writeFileSync(WALLET_DATA_FILE, exportedWallet);

  return { agent, config: agentConfig };
}
