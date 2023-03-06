import axios, { AxiosInstance } from 'axios'
import { axiosMethodOptions } from './config'
import * as FormData from 'form-data'
import * as path from 'path'
import * as tarStream from 'tar-stream'

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

  list = async (): Promise<any[] | null> => {
    if (!this.client) throw new Error('Call init first')

    const statRes = await this.client.post('/files/stat', null, {
      params: axiosMethodOptions.stat.params,
      headers: axiosMethodOptions.default.headers
    })

    const hash = statRes.data?.Hash
    if (!hash) throw new Error('An error occurred while fetching list')

    const listRes = await this.client.post('/ls', null, {
      params: { arg: hash },
      headers: axiosMethodOptions.default.headers
    })

    return listRes.data?.Objects[0]?.Links || null
  }

  upload = async (buffer: Buffer, filename: string): Promise<string> => {
    if (!this.client) throw new Error('Call init first')
    if (!buffer) throw new Error('Buffer is required')
    if (!buffer) throw new Error('Filename is required')

    const parsedPath = path.parse(filename)
    if (!parsedPath.ext) throw new Error('Filename extension is missing')

    const formData = new FormData()
    formData.append('file', buffer)

    const addRes = await this.client.post('/add', formData, {
      params: axiosMethodOptions.add.params,
      headers: axiosMethodOptions.add.headers
    })

    const hash = addRes.data?.Hash
    if (!hash) throw new Error('An error occurred during uploading')

    let cpRes = false
    let index = 1

    do {
      if (!(cpRes = await this.cp(hash, filename))) {
        filename = `${parsedPath.name}-${index}${parsedPath.ext}`
        index++
      }

      if (index === 100) throw new Error('An error occurred during uploading')
    } while (!cpRes)

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

  download = async (url: string): Promise<Buffer> => {
    if (!this.client) throw new Error('Call init first')

    try {
      const urlObj = new URL(url)
      const response = await this.client.post('/get', null, {
        params: { arg: urlObj.pathname },
        headers: axiosMethodOptions.download.headers,
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
            stream.on('end', () => {
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

  private cp = async (hash: string, filename: string): Promise<boolean> => {
    try {
      await this.client.post('/files/cp', null, {
        params: { arg: ['/btfs/' + hash, `/${filename}`] },
        headers: axiosMethodOptions.default.headers
      })

      return true
    } catch (error) {
      return false
    }
  }
}
export const pollinationX = new PollinationX()
