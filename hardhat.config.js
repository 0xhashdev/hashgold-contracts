require('@nomiclabs/hardhat-ethers')
require('@nomiclabs/hardhat-etherscan')
require('dotenv').config()
module.exports = {
  solidity: {
    compilers: [
      {
        version: '0.8.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
          }
        },
      },
      {
        version: '0.8.17',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
          }
        },
      },
      {
        version: '0.7.2',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
          }
        },
      },
      {
        version: '0.6.12',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
          }
        },
      },
      {
        version: '0.6.11',
        settings: {
          optimizer: {
            enabled: true,
            runs: 500,
          }
        },
      },
    ],
  },
  networks: {
    l1_testnet: {
      // gasPrice: 3e1,
      // gas: 2e10,
      // gasLimit: 2e10,
      url: process.env['TESTNET_L1RPC'] || '',
      accounts: process.env['DEVNET_PRIVKEY']
        ? [process.env['TESTNET_PRIVKEY']]
        : [],
    },
    l2_testnet: {
      // gasPrice: 3e1,
      // gas: 2e10,
      // gasLimit: 2e10,
      url: process.env['TESTNET_L2RPC'] || '',
      accounts: process.env['TESTNET_PRIVKEY']
        ? [process.env['TESTNET_PRIVKEY']]
        : [],
    },
    l1_mainnet: {
      // gas: 2100000,
      // gasLimit: 0,
      url: process.env['MAINNET_L1RPC'] || '',
      accounts: process.env['MAINNET_PRIVKEY']
        ? [process.env['MAINNET_PRIVKEY']]
        : [],
    },
    l2_mainnet: {
      gasPrice: 3e1,
      gas: 2e10,
      gasLimit: 2e10,
      url: process.env['MAINNET_L2RPC'] || '',
      accounts: process.env['MAINNET_PRIVKEY']
        ? [process.env['MAINNET_PRIVKEY']]
        : [],
    },
  },
  etherscan : {
    apiKey : {
      goerli: process.env['ETHERSCAN_API_KEY'],
      arbitrumGoerli: process.env['ARBISCAN_API_KEY']
    }
  }
}