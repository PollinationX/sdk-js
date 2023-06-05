import axios, { AxiosInstance } from 'axios'
import { IWallet } from './config/types'
import { axiosMethodOptions, cryptoConfig } from './config'
import * as FormData from 'form-data'
import * as tarStream from 'tar-stream'
import * as ethers from 'ethers'
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
}
export const pollinationX = new PollinationX()
