const express = require("express");
const cors = require("cors");
const { Connection, PublicKey, Keypair, Transaction, sendAndConfirmTransaction } = require("@solana/web3.js");
const { getOrCreateAssociatedTokenAccount, transfer, getAccount, TOKEN_PROGRAM_ID } = require("@solana/spl-token");
require("dotenv").config();

const app = express();
const port = 3000;

app.use(cors());
app.use(express.json());

const connection = new Connection("https://api.mainnet-beta.solana.com");
const OWNER = Keypair.fromSecretKey(Buffer.from(JSON.parse(process.env.PRIVATE_KEY)));
const OLD_DRD_MINT = new PublicKey(process.env.OLD_DRD_MINT);
const NEW_DRD_MINT = new PublicKey(process.env.NEW_DRD_MINT);
const MAX_NEW_DRD = 100_000_000 * 1e6;

let totalDistributed = 0;

app.post("/swap", async (req, res) => {
  try {
    const userPubkey = new PublicKey(req.body.wallet);
    const userOldToken = await getOrCreateAssociatedTokenAccount(connection, OWNER, OLD_DRD_MINT, userPubkey);
    const userNewToken = await getOrCreateAssociatedTokenAccount(connection, OWNER, NEW_DRD_MINT, userPubkey);
    const ownerNewToken = await getOrCreateAssociatedTokenAccount(connection, OWNER, NEW_DRD_MINT, OWNER.publicKey);

    const oldBalance = (await getAccount(connection, userOldToken.address)).amount;

    const oldAmount = parseInt(oldBalance.toString());
    if (oldAmount < 20 * 1e6) return res.status(400).json({ error: "Not enough OLD DRD to swap" });

    const newAmount = Math.floor(oldAmount / (20 * 1e6)) * 1e6;
    if (totalDistributed + newAmount > MAX_NEW_DRD) return res.status(400).json({ error: "Airdrop cap reached" });

    const tx = new Transaction().add(
      transfer(userOldToken.address, userOldToken.address, OWNER.publicKey, oldAmount, []),
      transfer(ownerNewToken.address, userNewToken.address, OWNER.publicKey, newAmount, [])
    );

    const signature = await sendAndConfirmTransaction(connection, tx, [OWNER]);
    totalDistributed += newAmount;

    res.json({ success: true, tx: signature });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Swap failed" });
  }
});

app.get("/", (_, res) => {
  res.send("DRD Swap Backend Running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
