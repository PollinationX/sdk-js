import axios, { AxiosInstance } from 'axios'
import { axiosMethodOptions } from './config'
import { IWallet } from './config/types'
import CryptoJS from 'crypto-js'
import * as FormData from 'form-data'
import * as path from 'path'
import * as tarStream from 'tar-stream'
import * as ethers from 'ethers'

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

    console.log('UPLOAD POLLINATIONX', encryptionSecret)
    console.log('BUFFER POLLINATIONX', buffer.toString())
    console.log('ENCRYPTED POLLINATIONX', CryptoJS.AES.encrypt(buffer.toString(), encryptionSecret as string).toString())
    const formData = new FormData()
    formData.append('file', encryptionSecret ? CryptoJS.AES.encrypt(buffer.toString(), encryptionSecret).toString() : buffer)

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

      console.log('UPLOAD POLLINATIONX', encryptionSecret)
      console.log('BUFFER POLLINATIONX', response.data)
      console.log('ENCRYPTED POLLINATIONX', CryptoJS.AES.encrypt(response.data, encryptionSecret as string).toString())
      const data = encryptionSecret ? CryptoJS.AES.decrypt(response.data, encryptionSecret).toString(CryptoJS.enc.Utf8) : response.data

      return new Promise(resolve => {
        const extract = tarStream.extract()

        extract.on('entry', (header, stream, next) => {
          if (header.type === 'file') {
            let fileBuffer = Buffer.alloc(0)
            stream.on('data', chunk => {
              fileBuffer = Buffer.concat([fileBuffer, chunk])
            })
            stream.on('end', () => {
              resolve(fileBuffer)
              next()
            })
          }
          stream.resume()
        })
        extract.end(Buffer.from(data))
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
