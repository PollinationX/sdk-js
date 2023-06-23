import axios, { AxiosInstance } from 'axios'
import { IContract, IIsWhitelistedParams, IWallet } from './config/types'
import { axiosMethodOptions, cryptoConfig, defaultTokenComparator, networkByChainId } from './config'
import { Alchemy } from 'alchemy-sdk'
import * as FormData from 'form-data'
import * as ethers from 'ethers'
import * as ethUtil from 'ethereumjs-util'
import * as tarStream from 'tar-stream'
import * as path from 'path'

let crypto
if (typeof window === 'undefined' || !window.crypto) {
  Promise.resolve().then(() =>
    import('crypto').then(cryptoModule => {
      crypto = cryptoModule.webcrypto
    })
  )
} else crypto = window.crypto

interface IInitParams {
  url: string
  token: string
}

class PollinationX {
  alchemy
  client: AxiosInstance

  init = (params: IInitParams): void => {
    if (!params?.url) throw new Error('Url is required')
    if (!params?.token) throw new Error('Token is required')

    this.client = axios.create({
      baseURL: params.url,
      headers: {
        common: {
          Authorization: `Bearer ${params.token}`
        }
      },
      paramsSerializer: {
        indexes: null
      }
    })
  }

  upload = async (buffer: Buffer, filename: string, encryptionSecret?: string): Promise<string> => {
    if (!this.client) throw new Error('Call init first')
    if (!buffer) throw new Error('Buffer is required')
    if (!buffer) throw new Error('Filename is required')

    const parsedPath = path.parse(filename)
    if (!parsedPath.ext) throw new Error('Filename extension is missing')

    let fileBuffer = buffer
    if (encryptionSecret) {
      const iv = crypto.getRandomValues(new Uint8Array(cryptoConfig.ivLength))
      fileBuffer = Buffer.concat([
        Buffer.from(iv),
        Buffer.from(
          await crypto.subtle.encrypt(
            { name: cryptoConfig.name, iv },
            await crypto.subtle.importKey('raw', Buffer.from(encryptionSecret, 'hex'), { name: cryptoConfig.name, length: cryptoConfig.length }, true, [
              'encrypt',
              'decrypt'
            ]),
            buffer
          )
        )
      ])
    }

    const formData = new FormData()
    formData.append('file', fileBuffer)

    const addRes = await this.client.post('/add', formData, {
      params: axiosMethodOptions.add.params,
      headers: axiosMethodOptions.add.headers
    })

    const hash = addRes.data?.Hash
    if (!hash) throw new Error('An error occurred during uploading')

    return hash
  }

  remove = async (filename: string): Promise<void> => {
    if (!this.client) throw new Error('Call init first')

    try {
      await this.client.post('/files/rm', null, {
        params: { arg: `/${filename}` },
        headers: axiosMethodOptions.default.headers
      })
    } catch (error) {
      throw new Error(error?.response?.data?.Message || 'An error occurred')
    }
  }

  download = async (hash: string, encryptionSecret?: string): Promise<Buffer> => {
    if (!this.client) throw new Error('Call init first')

    try {
      const response = await this.client.post('/get', null, {
        params: { arg: `/btfs/${hash}` },
        responseType: 'arraybuffer'
      })

      return new Promise(resolve => {
        const extract = tarStream.extract()

        extract.on('entry', (header, stream, next) => {
          if (header.type === 'file') {
            let fileBuffer = Buffer.alloc(0)
            stream.on('data', chunk => {
              fileBuffer = Buffer.concat([fileBuffer, chunk])
            })
            stream.on('end', async () => {
              if (encryptionSecret) {
                const dataBuffer = new Uint8Array(fileBuffer)
                fileBuffer = await crypto.subtle.decrypt(
                  { name: cryptoConfig.name, iv: dataBuffer.slice(0, cryptoConfig.ivLength) },
                  await crypto.subtle.importKey('raw', Buffer.from(encryptionSecret, 'hex'), { name: cryptoConfig.name, length: cryptoConfig.length }, true, [
                    'encrypt',
                    'decrypt'
                  ]),
                  dataBuffer.slice(cryptoConfig.ivLength)
                )
              }
              resolve(fileBuffer)
              next()
            })
          }
          stream.resume()
        })
        extract.end(Buffer.from(response.data))
      })
    } catch (error) {
      throw new Error(error?.response?.data?.Message || 'An error occurred')
    }
  }

  generateWallet = (): IWallet => {
    const wallet = ethers.Wallet.createRandom()
    return { address: wallet.address, mnemonic: wallet.mnemonic?.phrase, privateKey: wallet.privateKey }
  }

  isWhitelisted = async (params: IIsWhitelistedParams): Promise<boolean> => {
    const network = networkByChainId[params.chainId]
    if (!network) throw new Error('Invalid parameter: chainId')

    const { v, r, s } = ethUtil.fromRpcSig(params.signature)
    const address = ethUtil
      .bufferToHex(
        ethUtil.pubToAddress(
          ethUtil.ecrecover(
            ethUtil.toBuffer(ethUtil.keccak(Buffer.from(`\x19Ethereum Signed Message:\n${params.signMessage.length}${params.signMessage}`, 'utf-8'))),
            v,
            r,
            s
          )
        )
      )
      .toLowerCase()
    if (params?.addresses?.length && !params.addresses.map(address => address.toLowerCase()).includes(address)) throw new Error('Address is not whitelisted')

    this.alchemy = new Alchemy({
      apiKey: process.env.ALCHEMY_API_KEY,
      network
    })

    const ignoreTokenTypeConjunction = Object.values(params.token.type).length < 2
    const tokenTypeConjunction = params.token.conjunction || defaultTokenComparator.type
    let tokenTypeCompares: boolean[] = []

    for (const [type, token] of Object.entries(params.token.type)) {
      const contractAddresses: string[] = token.contracts.map((contract: IContract) => contract.address)
      const response = await this.alchemy.core.getTokenBalances(address, contractAddresses)
      const ignoreTokenConjunction = contractAddresses.length < 2
      const tokenConjunction = token.conjunction || defaultTokenComparator.token
      let tokenCompares: boolean[] = []

      for (const tokenValue of response.tokenBalances) {
        const tokenContract = token.contracts
          .map((contract: IContract) => ({ ...contract, address: contract.address.toLowerCase() }))
          .find((contract: IContract) => contract.address === tokenValue.contractAddress.toLowerCase())
        if (!tokenContract) throw new Error('Token address is invalid')

        const tokenBalance = parseInt(tokenValue.tokenBalance, 16).toString()
        const compare = ethers.BigNumber.from(tokenBalance)[tokenContract.conditions.comparator](ethers.BigNumber.from(tokenContract?.conditions?.value))
        if (!compare && (ignoreTokenConjunction || tokenConjunction === '&&')) throw new Error('Conditions does not match')
        tokenCompares.push(compare)
      }

      tokenCompares = tokenCompares.filter(status => status)
      if (!tokenCompares.length) {
        if (!ignoreTokenTypeConjunction && tokenTypeConjunction === '&&') throw new Error('Conditions does not match')
        tokenTypeCompares.push(false)
      } else tokenTypeCompares.push(true)
    }

    tokenTypeCompares = tokenTypeCompares.filter(status => status)
    if (tokenTypeCompares.length) {
      if (!ignoreTokenTypeConjunction && tokenTypeConjunction === '&&') throw new Error('Conditions does not match')
    } else throw new Error('Conditions does not match')

    return true
  }
}
export const pollinationX = new PollinationX()
