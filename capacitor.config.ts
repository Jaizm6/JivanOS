export interface CapacitorConfig {
  appId: string;
  appName: string;
  webDir: string;
  bundledWebRuntime?: boolean;
  server?: {
    androidScheme?: string;
  };
  plugins?: {
    CapacitorHttp?: {
      enabled: boolean;
    };
  };
  android?: {
    allowMixedContent?: boolean;
    captureInput?: boolean;
    webContentsDebuggingEnabled?: boolean;
    backgroundColor?: string;
  };
}

const config: CapacitorConfig = {
  appId: 'com.jaiz.jivanos',
  appName: 'JivanOS',
  webDir: 'dist',
  bundledWebRuntime: false,
  server: {
    androidScheme: 'https',
  },
  plugins: {
    CapacitorHttp: {
      enabled: true,
    },
  },
  android: {
    allowMixedContent: true,
    captureInput: true,
    webContentsDebuggingEnabled: false,
    backgroundColor: '#000000',
  },
};

export default config;
