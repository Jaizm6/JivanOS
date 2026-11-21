declare module 'megajs/dist/main.browser-es.mjs' {
  export class Storage {
    api: any;
    key: any;
    sid: string;
    name: string;
    user: string;
    email: string;
    options: Record<string, any>;
    root: any;
    files: Record<string, any>;
    ready: Promise<this>;
    constructor(options: Record<string, any>);
    toJSON(): {
      key: string;
      sid: string;
      name: string;
      user: string;
      options: Record<string, any>;
    };
    close(): Promise<void>;
    mkdir(name: string): Promise<any>;
    reload(force?: boolean): Promise<any[]>;
    static fromJSON(json: Record<string, any>): Storage;
  }
}
