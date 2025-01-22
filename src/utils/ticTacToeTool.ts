import { ChatOpenAI } from "@langchain/openai";
import { CdpAgentkit } from "@coinbase/cdp-agentkit-core";
import { CdpTool, CdpToolkit } from "@coinbase/cdp-langchain";
import { TwitterToolkit } from "@coinbase/twitter-langchain";
import { Tool } from "@langchain/core/tools";
import { z } from "zod";

interface GameTools {
  twitterTools: Tool[];
  cdpTools: Tool[];
}

class TicTacToe {
  private board: string[][];
  private currentPlayer: string;
  private agentkit: CdpAgentkit;
  private chatOpenAI: ChatOpenAI;
  private gameActive: boolean;
  private tools: GameTools;
  private lastWinTransaction: string | null;

  constructor(
    agentkit: CdpAgentkit,
    chatOpenAI: ChatOpenAI,
    twitterToolkit: TwitterToolkit,
    cdpToolkit: CdpToolkit
  ) {
    this.board = Array(3)
      .fill(null)
      .map(() => Array(3).fill(" "));
    this.currentPlayer = "X";
    this.agentkit = agentkit;
    this.chatOpenAI = chatOpenAI;
    this.gameActive = false;
    this.tools = {
      twitterTools: twitterToolkit.getTools() as Tool[],
      cdpTools: cdpToolkit.getTools() as Tool[],
    };
    this.lastWinTransaction = null;
  }

  getChatOpenAI(): ChatOpenAI {
    return this.chatOpenAI;
  }

  getAgentkit(): CdpAgentkit {
    return this.agentkit;
  }

  printBoard(): string {
    if (!this.gameActive) {
      return "No active game. Start a new game with the 'start' command.";
    }

    let output = "Current board:\n\n";
    output += "     0   1   2  \n";

    for (let i = 0; i < 3; i++) {
      output += `${i}    ${this.board[i]
        .map((cell) => (cell === " " ? "-" : cell))
        .join(" | ")}\n`;
      if (i < 2) output += "    -----------\n";
    }

    return output;
  }

  parseMove(moveStr: string): { row: number; col: number } | null {
    // Handle (row, col) format
    const match = moveStr.match(/^\s*\(?\s*(\d)\s*,\s*(\d)\s*\)?\s*$/);
    if (!match) return null;

    const row = parseInt(match[1]);
    const col = parseInt(match[2]);

    if (row >= 0 && row < 3 && col >= 0 && col < 3) {
      return { row, col };
    }
    return null;
  }

  // V1
  async makeMove(moveInput: string | number[]): Promise<string> {
    if (!this.gameActive) {
      return "No active game. Start a new game with the 'start' command.";
    }

    let row: number, col: number;

    if (typeof moveInput === "string") {
      const parsed = this.parseMove(moveInput);
      if (!parsed) {
        return "Invalid move format. Please use (row, col) format, e.g., (0, 2)";
      }
      row = parsed.row;
      col = parsed.col;
    } else {
      [row, col] = moveInput;
    }

    if (!this.isValidMove(row, col)) {
      return `Invalid move at (${row}, ${col}). The cell is either occupied or out of bounds.\n${this.printBoard()}`;
    }

    // Make player's move
    this.board[row][col] = this.currentPlayer;
    let response = `You placed ${
      this.currentPlayer
    } at (${row}, ${col}).\n${this.printBoard()}\n`;

    if (this.checkWin()) {
      this.gameActive = false;
      return `${response}\nPlayer ${this.currentPlayer} wins! Game Over.\n\nCongratulations! As a victory reward, would you like me to request 20 USDC faucet funds for you? (yes/no)`;
    }

    if (this.checkDraw()) {
      this.gameActive = false;
      return `${response}It's a draw! Game Over.`;
    }

    // Switch to agent's turn
    this.currentPlayer = "O";
    response += "\nAgent's turn...\n";

    // Make agent's move
    const agentMove = await this.makeAgentMove();
    response += `Agent placed O at (${agentMove.row}, ${
      agentMove.col
    }).\n${this.printBoard()}\n`;

    if (this.checkWin()) {
      this.gameActive = false;
      return `${response}Agent (O) wins! Game Over.`;
    }

    if (this.checkDraw()) {
      this.gameActive = false;
      return `${response}It's a draw! Game Over.`;
    }

    this.currentPlayer = "X";
    return `${response}Your turn! Make your move (row, col):`;
  }

  private async handlePlayerWin(winMessage: string): Promise<string> {
    // First offer faucet funds as a victory reward
    const offerMessage = `${winMessage}\n\nCongratulations! As a victory reward, would you like me to request 20 USDC faucet funds for you? (yes/no)`;
    return offerMessage;
  }

  async handleCommand(command: string): Promise<string> {
    const normalizedCommand = command.toLowerCase();

    // Handle faucet response
    if (
      (normalizedCommand === "yes" ||
        normalizedCommand.includes("request") ||
        normalizedCommand.includes("faucet")) &&
      !this.lastWinTransaction
    ) {
      try {
        const faucetTool = this.tools.cdpTools.find(
          (tool) => tool.name === "request_faucet"
        );
        if (faucetTool) {
          const result = await faucetTool.invoke({
            token: "USDC",
            amount: "20",
          });
          // Assuming result contains transaction hash
          this.lastWinTransaction = result.transactionHash;
          return `Received usdc from the faucet. Transaction: https://sepolia.basescan.org/tx/${this.lastWinTransaction}`;
        }
      } catch (error) {
        console.error("Error requesting faucet funds:", error);
        return "Sorry, there was an error requesting faucet funds.";
      }
    }

    // Handle tweet command
    if (command.toLowerCase().includes("tweet")) {
      try {
        const postTweetTool = this.tools.twitterTools.find(
          (tool) => tool.name === "post_tweet"
        );
        if (postTweetTool) {
          const tweetText =
            "🎉 I just won a Tic-Tac-Toe game against an AI! 🎊 #GameWinner #TicTacToe";
          const result = await postTweetTool.invoke({ text: tweetText });
          return `Successfully posted to Twitter:\n${JSON.stringify(result)}`;
        }
      } catch (error) {
        console.error("Error posting tweet:", error);
        return "Sorry, there was an error posting your tweet.";
      }
    }

    return "Invalid command. Available commands: 'yes' for faucet funds, 'tweet about the win' to share your victory.";
  }

  async handleFaucetResponse(response: string): Promise<string> {
    if (response.toLowerCase() === "yes") {
      try {
        // Find the faucet request tool
        const faucetTool = this.tools.cdpTools.find(
          (tool) => tool.name === "request_faucet"
        );

        if (faucetTool) {
          // Request USDC faucet funds
          const result = await faucetTool.invoke({
            token: "USDC",
            amount: "20",
          });

          // After successful faucet request, offer to tweet
          return "Successfully requested 20 USDC from faucet! 🎉\nWould you like me to tweet about your victory? (tweet yes/no)";
        }
        return "Couldn't find the faucet tool. Would you like to tweet about your victory instead? (tweet yes/no)";
      } catch (error) {
        console.error("Error requesting faucet funds:", error);
        return "Sorry, there was an error requesting faucet funds. Would you like to tweet about your victory instead? (tweet yes/no)";
      }
    } else {
      // If they decline faucet funds, offer to tweet
      return "No problem! Would you like me to tweet about your victory instead? (tweet yes/no)";
    }
  }

  async handleTweetResponse(response: string): Promise<string> {
    if (response.toLowerCase() === "yes") {
      try {
        const tweetText = `🎮 Just won a game of Tic-Tac-Toe against an AI and got rewarded with USDC! 🎯💰\n#Gaming #AI #Victory #Crypto`;
        const postTweetTool = this.tools.twitterTools.find(
          (tool) => tool.name === "post_tweet"
        );

        if (postTweetTool) {
          await postTweetTool.invoke({ text: tweetText });
          return "Victory tweet posted successfully! 🎉";
        }
        return "Couldn't find the tweet posting tool. Tweet not posted.";
      } catch (error) {
        console.error("Error posting tweet:", error);
        return "Sorry, there was an error posting your tweet.";
      }
    } else {
      return "No problem! Would you like to start another game?";
    }
  }

  private async makeAgentMove(): Promise<{ row: number; col: number }> {
    // First try to win
    const winMove = this.findWinningMove("O");
    if (winMove) return winMove;

    // Then try to block opponent
    const blockMove = this.findWinningMove("X");
    if (blockMove) return blockMove;

    // Try to take center if available
    if (this.board[1][1] === " ") {
      this.board[1][1] = "O";
      return { row: 1, col: 1 };
    }

    // Take any corner
    const corners = [
      [0, 0],
      [0, 2],
      [2, 0],
      [2, 2],
    ];
    for (const [row, col] of corners) {
      if (this.board[row][col] === " ") {
        this.board[row][col] = "O";
        return { row, col };
      }
    }

    // Take any available space
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (this.board[row][col] === " ") {
          this.board[row][col] = "O";
          return { row, col };
        }
      }
    }

    throw new Error("No valid moves available");
  }

  private findWinningMove(player: string): { row: number; col: number } | null {
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        if (this.board[row][col] === " ") {
          this.board[row][col] = player;
          if (this.checkWin()) {
            if (player === "O") {
              return { row, col };
            } else {
              this.board[row][col] = " ";
              this.board[row][col] = "O";
              return { row, col };
            }
          }
          this.board[row][col] = " ";
        }
      }
    }
    return null;
  }

  private checkWin(): boolean {
    // Check rows, columns and diagonals
    for (let i = 0; i < 3; i++) {
      if (
        this.board[i][0] !== " " &&
        this.board[i][0] === this.board[i][1] &&
        this.board[i][1] === this.board[i][2]
      )
        return true;

      if (
        this.board[0][i] !== " " &&
        this.board[0][i] === this.board[1][i] &&
        this.board[1][i] === this.board[2][i]
      )
        return true;
    }

    if (
      this.board[0][0] !== " " &&
      this.board[0][0] === this.board[1][1] &&
      this.board[1][1] === this.board[2][2]
    )
      return true;

    if (
      this.board[0][2] !== " " &&
      this.board[0][2] === this.board[1][1] &&
      this.board[1][1] === this.board[2][0]
    )
      return true;

    return false;
  }

  private checkDraw(): boolean {
    return this.board.every((row) => row.every((cell) => cell !== " "));
  }

  private isValidMove(row: number, col: number): boolean {
    return (
      row >= 0 && row < 3 && col >= 0 && col < 3 && this.board[row][col] === " "
    );
  }

  startGame(): string {
    this.board = Array(3)
      .fill(null)
      .map(() => Array(3).fill(" "));
    this.currentPlayer = "X";
    this.gameActive = true;
    this.lastWinTransaction = null;
    return `New game started! You are X, Agent is O.\n${this.printBoard()}\nMake your move using (row, col) format, e.g., (0, 2)`;
  }
}

const TicTacToeInput = z
  .object({
    action: z
      .string()
      .describe("The action to perform: start, move, print, or command"),
    move: z
      .string()
      .optional()
      .describe("The move in format (row, col), e.g., (0, 2)"),
    command: z
      .string()
      .optional()
      .describe("Command to execute (yes for faucet, tweet about win)"),
  })
  .strip();

async function ticTacToeHandler(
  game: TicTacToe,
  args: z.infer<typeof TicTacToeInput>
): Promise<string> {
  const { action, move, command } = args;

  switch (action.toLowerCase()) {
    case "start":
      return game.startGame();
    case "move":
      if (!move) {
        return "Invalid input. Please provide move in format (row, col)";
      }
      return await game.makeMove(move);
    case "print":
      return game.printBoard();
    case "command":
      if (!command) {
        return "Invalid input. Please provide a command";
      }
      return await game.handleCommand(command);

    default:
      return 'Invalid action. Use "start", "move (row, col)", or enter a command.';
  }
}

export async function createTicTacToeTool(
  agentkit: CdpAgentkit,
  chatOpenAI: ChatOpenAI,
  twitterToolkit: TwitterToolkit,
  cdpToolkit: CdpToolkit
) {
  const game = new TicTacToe(agentkit, chatOpenAI, twitterToolkit, cdpToolkit);

  const ticTacToeTool = new CdpTool(
    {
      name: "tic_tac_toe",
      description:
        "Play Tic-Tac-Toe against an AI agent. Winners can receive USDC faucet funds and tweet about their victory!",
      argsSchema: TicTacToeInput,
      func: async (args: z.infer<typeof TicTacToeInput>) =>
        ticTacToeHandler(game, args),
    },
    agentkit
  );

  return ticTacToeTool;
}
