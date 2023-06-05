import { IAxiosMethodOptions, ICryptoConfig } from './types'

export const axiosMethodOptions: IAxiosMethodOptions = {
  default: {
    headers: {
      'Content-Type': 'application/json'
    }
  },
  add: {
    headers: {
      'Content-Type': 'multipart/form-data'
    },
    params: {
      'stream-channels': true,
      pin: true,
      progress: false
    }
  },
  stat: {
    params: {
      arg: '/'
    }
  }
}

export const cryptoConfig: ICryptoConfig = {
  name: 'AES-GCM',
  length: 256,
  ivLength: 12
}
