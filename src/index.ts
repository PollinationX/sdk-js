import axios, { AxiosInstance } from 'axios'
import { axiosMethodOptions } from './config'
import { IWallet } from './config/types'
import * as FormData from 'form-data'
import * as path from 'path'
import * as tarStream from 'tar-stream'
import * as ethers from 'ethers'
// import * as crypto from 'crypto'
let crypto
if (typeof window !== 'undefined' && window.crypto) {
  // Browser environment
  crypto = window.crypto
} else {
  // Node.js environment
  Promise.resolve().then(() =>
    import('crypto').then(cryptoModule => {
      crypto = cryptoModule.webcrypto
    })
  )
}
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
      // const encryptionAlgoName = 'AES-GCM'
      // const encryptionAlgo = {
      //   name: encryptionAlgoName,
      //   iv: crypto.getRandomValues(new Uint8Array(12))
      // }
      //
      // const encryptionKey = await crypto.subtle.importKey(
      //   'raw',
      //   new Uint32Array([1,2,3,4,5,6,7,8]),
      //   { name: encryptionAlgoName },
      //   true,
      //   ["encrypt", "decrypt"],
      // )
      //
      // // encrypt the image
      // fileBuffer = await crypto.subtle.encrypt(
      //   encryptionAlgo,
      //   encryptionKey,
      //   buffer
      // )

      const keyBuffer = Buffer.from(encryptionSecret, 'hex')
      const secretKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
      const iv = crypto.getRandomValues(new Uint8Array(12))
      const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, secretKey, buffer)
      fileBuffer = Buffer.concat([Buffer.from(iv), Buffer.from(encryptedData)])
      console.log(encryptedData, 'ENCRYPTED ENCRYPT')
      console.log(fileBuffer, 'FILE BUFFER ENCRYPT')
      console.log(iv, 'IV ENCRYPT')

      // const encryptionAlgoName = 'AES-GCM'
      // const encryptionAlgo = {
      //   name: encryptionAlgoName,
      //   iv: crypto.getRandomValues(new Uint8Array(12)) // 96-bit
      // }
      //
      // // create a 256-bit AES encryption key
      // const encryptionKey = await crypto.subtle.importKey(
      //   'raw',
      //   new Uint32Array([1,2,3,4,5,6,7,8]),
      //   { name: encryptionAlgoName },
      //   true,
      //   ["encrypt", "decrypt"],
      // )
      //
      // // fetch a JPEG image
      // // const imgBufferOrig = await (await fetch('https://fetch-progress.anthum.com/images/sunrise-baseline.jpg')).arrayBuffer()
      //
      // // encrypt the image
      // fileBuffer = await crypto.subtle.encrypt(
      //   encryptionAlgo,
      //   encryptionKey,
      //   buffer
      // )
      // const keyBuffer = Buffer.from(encryptionSecret, 'hex');
      // const secretKey: any = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
      //
      // // const keyData = await crypto.subtle.importKey('raw', Buffer.from(encryptionSecret, 'hex'), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt'])
      // const encryptionKey = await crypto.subtle.importKey(
      //   'raw',
      //   secretKey,
      //   { name: encryptionAlgoName },
      //   true,
      //   ["encrypt", "decrypt"],
      // )
      //
      // file = await crypto.subtle.encrypt(
      //   'AES-GCM',
      //   encryptionKey,
      //   imgBufferOrig
      // )
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

      let fileBuffer: any = response.data

      if (encryptionSecret) {
        // const encryptionAlgoName = 'AES-GCM'
        // const encryptionAlgo = {
        //   name: encryptionAlgoName,
        //   iv: crypto.getRandomValues(new Uint8Array(12))
        // }
        //
        // const encryptionKey = await crypto.subtle.importKey(
        //   'raw',
        //   new Uint32Array([1,2,3,4,5,6,7,8]),
        //   { name: encryptionAlgoName },
        //   true,
        //   ["encrypt", "decrypt"],
        // )
        //
        // // encrypt the image
        // fileBuffer = await crypto.subtle.decrypt(
        //   encryptionAlgo,
        //   encryptionKey,
        //   response.data
        // )

        const dataBuffer = new Uint8Array(response.data)
        const keyBuffer = Buffer.from(encryptionSecret, 'hex')
        const secretKey = await crypto.subtle.importKey('raw', keyBuffer, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
        const iv = dataBuffer.slice(0, 12)
        const encryptedData = dataBuffer.slice(12)
        fileBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, secretKey, encryptedData)
        console.log(response.data, 'RESPONSE ARRAY BUFFER DECRYPT')
        console.log(fileBuffer, 'FILE BUFFER DECRYPT')
        console.log(iv, 'IV DECRYPT')

        // const encryptionAlgoName = 'AES-GCM'
        // const encryptionAlgo = {
        //   name: encryptionAlgoName,
        //   iv: crypto.getRandomValues(new Uint8Array(12)) // 96-bit
        // }
        //
        // // create a 256-bit AES encryption key
        // const encryptionKey = await crypto.subtle.importKey(
        //   'raw',
        //   new Uint32Array([1, 2, 3, 4, 5, 6, 7, 8]),
        //   { name: encryptionAlgoName },
        //   true,
        //   ["encrypt", "decrypt"],
        // )
        //
        // fileBuffer = await crypto.subtle.decrypt(
        //   encryptionAlgo,
        //   encryptionKey,
        //   response.data
        // )
      }

      // const data = encryptionSecret ? CryptoJS.AES.decrypt(response.data, encryptionSecret).toString(CryptoJS.enc.Utf8) : response.data

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
        extract.end(Buffer.from(fileBuffer))
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
