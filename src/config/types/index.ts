import { Network } from 'alchemy-sdk'

export type TComparator = 'gt' | 'lt' | 'eq' | 'gte' | 'lte'
export type TConjunction = '&&' | '||'
export type TTokenType = 'ERC20' | 'ERC721'

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

export interface INetworkByChainId {
  [key: number]: Network
}

export interface IDefaultTokenConjunction {
  token: TConjunction
  type: TConjunction
}

export interface IIsWhitelistedParams {
  chainId: number
  signMessage: string
  signature: string
  token: ITokenType
  addresses?: string[]
}

export interface ITokenType {
  type: {
    [K in TTokenType]?: IToken
  }
  conjunction?: TConjunction
}

export interface IContract {
  address: string
  conditions: IConditions
}

export interface IConditions {
  comparator: TComparator
  value: string
}

export interface IToken {
  contracts: IContract[]
  conjunction?: TConjunction
}
