const { ethers } = require('hardhat')
const { providers, Wallet } = require('ethers')
const { getL1Network, getL2Network, L1ToL2MessageStatus } = require('@arbitrum/sdk')

const fetch = require('node-fetch');

const { setTimeout } = require('timers/promises')

const requireEnvVariables = envVars => {
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      throw new Error(`Error: set your '${envVar}' environmental variable `)
    }
  }
  console.log('Environmental variables properly set 👍')
}

const {
  AdminErc20Bridger,
} = require('@arbitrum/sdk/dist/lib/assetBridger/erc20Bridger')

const { expect } = require('chai')

require('dotenv').config()

requireEnvVariables([
  'TESTNET_PRIVKEY', 
  'TESTNET_L1RPC', 
  'TESTNET_L2RPC',
  'TESTNET_L1_EXPLORER',
  'TESTNET_L2_EXPLORER'
])

/**
 * Set up: instantiate L1 / L2 wallets connected to providers
 */
const walletPrivateKey = process.env.TESTNET_PRIVKEY

const l1Provider = new providers.JsonRpcProvider(process.env.TESTNET_L1RPC)
const l2Provider = new providers.JsonRpcProvider(process.env.TESTNET_L2RPC)

const l1Wallet = new Wallet(walletPrivateKey, l1Provider)
const l2Wallet = new Wallet(walletPrivateKey, l2Provider)

console.log("L1 Wallet Address:", l1Wallet.address)
console.log("L2 Wallet Address:", l2Wallet.address)

const main = async () => {
  // const network = 'goerli';
  // const res = await fetch(`https://api.owlracle.info/v3/${ network }/gas?`);
  // const data = await res.json();

  // console.log(`WARNING: gas fee on ${network} is between ${data.speeds[0].baseFee} - ${data.speeds[data.speeds.length-1].baseFee} GWei`)

  /**
   * Use l2Network to create an Arbitrum SDK AdminErc20Bridger instance
   * We'll use AdminErc20Bridger for its convenience methods around registering tokens to the custom gateway
   */
  const l1Network = await getL1Network(l1Provider)
  const l2Network = await getL2Network(l2Provider)

  console.log(`l1Network is:`, l1Network);
  console.log(`l2Network is:`, l2Network);

  const adminTokenBridger = new AdminErc20Bridger(l2Network)

  /**
   * Deploy our custom L2 gateway
   * We give the custom token contract the address of l1CustomGateway and l1GatewayRouter as well as the initial supply (premine)
   */
  const CustomL2Gateway = await (
    await ethers.getContractFactory('CustomL2Gateway')
  ).connect(l2Wallet)

  console.log('Deploying custom gateway to L2')

  const l2CustomGateway = await CustomL2Gateway.deploy()
  await l2CustomGateway.deployed()

  console.log(`Custom gateway is deployed L2. Check ${process.env.TESTNET_L2_EXPLORER}/address/${l2CustomGateway.address}`)

  /**
   * Deploy our custom L1 gateway
   * We give the custom token contract the address of l1CustomGateway and l1GatewayRouter as well as the initial supply (premine)
   */
  const CustomL1Gateway = await (
    await ethers.getContractFactory('CustomL1Gateway')
  ).connect(l1Wallet)

  console.log('Deploying custom gateway to L1', {
    "l2CustomGateway.address": l2CustomGateway.address,
    "l2Network.tokenBridge.l1GatewayRouter": l2Network.tokenBridge.l1GatewayRouter,
    "l2Network.ethBridge.inbox": l2Network.ethBridge.inbox
  })
  const l1CustomGateway = await CustomL1Gateway.deploy(
    l2CustomGateway.address,
    l2Network.tokenBridge.l1GatewayRouter,
    l2Network.ethBridge.inbox
  )
  await l1CustomGateway.deployed()

  console.log(`Custom gateway is deployed L1. Check ${process.env.TESTNET_L1_EXPLORER}/address/${l1CustomGateway.address}`)


  // Initialize L2 custom gateway:
  console.log("Initializing L2 custom gateway....",{
    "l1CustomGateway.address" : l1CustomGateway.address,
    "l2Network.tokenBridge.l2GatewayRouter" : l2Network.tokenBridge.l2GatewayRouter
  });

  await l2CustomGateway.initialize(
    l1CustomGateway.address,
    l2Network.tokenBridge.l2GatewayRouter,
  );
  console.log("L2 Custom gateway initialized.")

  const l1Gateway = l1CustomGateway.address
  const l2Gateway = l2CustomGateway.address
  const l1Router  = l2Network.tokenBridge.l1GatewayRouter

  /**
   * Deploy our custom token smart contract to L1
   * We give the custom token contract the address of l1CustomGateway and l1GatewayRouter
   */
  const L1TestnetHashgold = await (
    await ethers.getContractFactory('L1TestnetHashgold')
  ).connect(l1Wallet)

  console.log('Deploying custom token to L1', {
    "l1Gateway": l1Gateway, 
    "l1Router": l1Router
  })
  const l1Token = await L1TestnetHashgold.deploy(l1Gateway, l1Router)
  await l1Token.deployed()

  console.log(`Custom token is deployed to L1. Check ${process.env.TESTNET_L1_EXPLORER}/address/${l1Token.address}`)

  /**
   * Deploy our custom token smart contract to L2
   * We give the custom token contract the address of l2CustomGateway and our l1Token
   */
  const L2TestnetHashgold = await (
    await ethers.getContractFactory('L2TestnetHashgold')
  ).connect(l2Wallet)

  console.log('Deploying custom token to L2', {
    "l2Gateway": l2Gateway,
    "l1Token.address": l1Token.address
  })
  const l2Token = await L2TestnetHashgold.deploy(
    l2Gateway,
    l1Token.address
  )
  await l2Token.deployed()

  console.log(`Custom token is deployed to L2. Check ${process.env.TESTNET_L2_EXPLORER}/address/${l2Token.address}`)

  console.log('Registering custom token on L2:')
  /**
   * ٍRegister custom token on our custom gateway
   */
  const registerTokenTxL2 = await adminTokenBridger.registerCustomToken(
    l1Token.address,
    l2Token.address,
    l1Wallet,
    l2Provider
  )

  const registerTokenReceiptL1 = await registerTokenTxL2.wait()

  console.log(
    `Registering token txn confirmed on L1! 🙌 L1 receipt is: ${registerTokenReceiptL1.transactionHash}`
  )

  /**
   * The L1 side is confirmed; now we listen and wait for the for the Sequencer to include the L2 side; we can do this by computing the expected txn hash of the L2 transaction.
   * To compute this txn hash, we need our message's "sequence numbers", unique identifiers of each L1 to L2 message. We'll fetch them from the event logs with a helper method
   */
  const l1ToL2Msgs = await registerTokenReceiptL1.getL1ToL2Messages(l2Provider)

  /**
   * In principle, a single L1 txn can trigger any number of L1-to-L2 messages (each with its own sequencer number).
   * In this case, the registerTokenOnL2 method created 2 L1-to-L2 messages; (1) one to set the L1 token to the Custom Gateway via the Router, and (2) another to set the L1 token to its L2 token address via the Generic-Custom Gateway
   * Here, We check if both messages are redeemed on L2
   */
  expect(l1ToL2Msgs.length, 'Should be 2 messages.').to.eq(2)
  const setTokenTx = await l1ToL2Msgs[0].waitForStatus()

  expect(setTokenTx.status, 'Set token not redeemed.').to.eq(
    L1ToL2MessageStatus.REDEEMED
  )
  const setGateways = await l1ToL2Msgs[1].waitForStatus()

  expect(setGateways.status, 'Set gateways not redeemed.').to.eq(
    L1ToL2MessageStatus.REDEEMED
  )

  const L1GatewayAddressOnL1Router = await (new ethers.Contract(l2Network.tokenBridge.l1GatewayRouter.address, 
    ["function getGateway(address _token) returns (address)"] )
  ).getGateway(l1Token.address) // Should be equal to l1CustomGateway.address
  console.log(`L1GatewayAddressOnL1Router is ${L1GatewayAddressOnL1Router}, should be equal to ${l1CustomGateway.address}`);


  const L2GatewayAddressOnL2Router = await (new ethers.Contract(l2Network.tokenBridge.l2GatewayRouter.address, 
    ["function getGateway(address _token) returns (address)"] )
  ).getGateway(l1Token.address) // Should be equal to l2CustomGateway.address
  console.log(`L2GatewayAddressOnL2Router is ${L2GatewayAddressOnL2Router}, should be equal to ${l2CustomGateway.address}`);

  const l2TokenAddressOnL1Gateway = await l1CustomGateway.calculateL2TokenAddress(l1Token.address) 
  console.log(`l2AddressOnL1Gateway is ${l2TokenAddressOnL1Gateway}, should be equal to ${l2Token.address}`);

  const l1TokenAddressOnL2Gateway = await l2CustomGateway.calculateL2TokenAddress(l2Token.address)
  console.log(`l1AddressOnL1Gateway is ${l1TokenAddressOnL2Gateway}, should be equal to ${l1Token.address}`);

  console.log(
    'Your custom token is now registered on our custom gateway 🥳  Go ahead and make the deposit!'
  )

}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })