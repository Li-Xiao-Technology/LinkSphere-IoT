declare module 'nodes7' {
  interface NodeS7Instance {
    initiateConnection(options: {
      port: number;
      host: string;
      rack: number;
      slot: number;
      timeout?: number;
    }, callback: (err: Error | undefined) => void): void;
    dropConnection(callback?: (err: Error | null) => void): void;
    setTranslationCB(callback: (name: string) => { area: number; dbNumber: number; start: number; type: string }): void;
    addItems(items: string | string[]): void;
    readAllItems(callback: (anythingBad: boolean, values: any) => void): void;
    writeItems(items: string | string[], values: any | any[], callback: (anythingBad: boolean, values: any) => void): void;
  }

  const nodes7: {
    new (options?: { silent?: boolean }): NodeS7Instance;
  };

  export = nodes7;
}