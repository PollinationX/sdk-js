export interface IAxiosMethodOptions {
  default: {
    headers: {
      [key: string]: string
    }
  }
  add: {
    headers: {
      [key: string]: string
    }
    params: {
      'stream-channels': boolean
      pin: boolean
      progress: boolean
    }
  }
  stat: {
    params: {
      arg: string
    }
  }
}

export interface IWallet {
  address: string
  mnemonic?: string
  privateKey: string
}

export interface ICryptoConfig {
  name: string
  length: number
  ivLength: number
}
