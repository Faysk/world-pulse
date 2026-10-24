// Transaction pooling may discard startup/session parameters. SET LOCAL is
// bound to the same transaction/physical backend as the actual statements.
export async function beginLimitedTransaction(client) {
  await client.query("BEGIN; SET LOCAL statement_timeout='5s'; SET LOCAL lock_timeout='1s'; SET LOCAL idle_in_transaction_session_timeout='10s'");
}
