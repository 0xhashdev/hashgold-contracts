const { ethers } = require('hardhat')
const { providers, Wallet } = require('ethers')
const { getL2Network } = require('@arbitrum/sdk')

const fetch = require('node-fetch');

// const { setTimeout } = require('timers/promises')

const requireEnvVariables = envVars => {
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      throw new Error(`Error: set your '${envVar}' environmental variable `)
    }
  }
  console.log('Environmental variables properly set 👍')
}

// const {
//   AdminErc20Bridger,
// } = require('@arbitrum/sdk/dist/lib/assetBridger/erc20Bridger')

const { expect } = require('chai')

require('dotenv').config()

requireEnvVariables([
  'TESTNET_PRIVKEY', 
  'TESTNET_L1RPC', 
  'TESTNET_L2RPC',
  'TESTNET_L1_EXPLORER',
  'TESTNET_L2_EXPLORER',
  'MAINNET_PRIVKEY',
  'MAINNET_L1RPC',
  'MAINNET_L2RPC',
  'MAINNET_L1_EXPLORER',
  'MAINNET_L2_EXPLORER'
])

/**
 * Set up: instantiate L1 / L2 wallets connected to providers
 */
const walletPrivateKey = process.env.MAINNET_PRIVKEY
const l2Provider = new providers.JsonRpcProvider(process.env.MAINNET_L2RPC)

const l2Wallet = new Wallet(walletPrivateKey, l2Provider)

console.log("L2 Wallet Address:", l2Wallet.address)

const main = async () => {

  // const network = 'arbitrum';
  // const res = await fetch(`https://api.owlracle.info/v3/${ network }/gas?`);
  // const data = await res.json();

  //console.log(`WARNING: gas fee on ${network} is between ${data.speeds[0].baseFee} - ${data.speeds[data.speeds.length-1].baseFee} GWei`)
  console.log("provider is :", l2Provider)
  const l2Network = await getL2Network(l2Provider)

  console.log(`l2Network is:`, l2Network);

  /**
   * Deploy our custom token smart contract to L2
   * We give the custom token contract the address of l2CustomGateway and our l1CustomToken
   */
  const DummyL2Token = await (
    await ethers.getContractFactory('DummyL2Token')
  ).connect(l2Wallet)

  console.log('Deploying custom token to L2...')
  const l2CustomToken = await DummyL2Token.deploy()
  await l2CustomToken.deployed()
  console.log(`Custom token is deployed to L2. Check ${process.env.MAINNET_L2_EXPLORER}/address/${l2CustomToken.address}`)
}

main()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error)
    process.exit(1)
  })