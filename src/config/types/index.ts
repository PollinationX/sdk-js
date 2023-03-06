export interface IAxiosMethodOptions {
  default: {
    headers: {
      [key: string]: string
    }
  }
  download: {
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
