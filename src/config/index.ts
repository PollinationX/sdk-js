import { IAxiosMethodOptions, ICryptoConfig, IDefaultTokenConjunction, INetworkByChainId } from './types';
import { Network } from 'alchemy-sdk';

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

export const networkByChainId: INetworkByChainId = {
  11155111: Network.MATIC_MUMBAI
}

export const defaultTokenComparator: IDefaultTokenConjunction = {
  token: '||',
  type: '||'
}
