/**
 * 米家 OAuth2.0 协议对接框架
 *
 * 实现米家开放平台 OAuth2.0 授权流程，获取用户授权设备列表。
 * 使用前需在米家开放平台 (https://open.home.mi.com) 注册应用获取 appId 和 appSecret。
 *
 * 流程：
 * 1. 用户跳转到米家授权页面
 * 2. 授权后回调携带 code
 * 3. 用 code 换取 access_token
 * 4. 用 access_token 获取用户设备列表
 * 5. 通过 MQTT 订阅设备状态变更
 */

import { Device, DeviceState } from '../types';
import { MijiaAdapter } from './MijiaAdapter';

interface MijiaConfig {
  appId: string;
  appSecret: string;
  redirectUri: string;
  authUrl: string;
  tokenUrl: string;
  apiUrl: string;
}

interface MijiaTokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface MijiaDeviceListResponse {
  code: number;
  message: string;
  result: {
    list: MijiaRawDevice[];
  };
}

interface MijiaRawDevice {
  did: string;
  name: string;
  model: string;
  pid: number;
  pmodel: string;
  sn: string;
  mac: string;
  bssid?: string;
  ssid?: string;
}

export class MijiaOAuthAdapter extends MijiaAdapter {
  private config: MijiaConfig;
  private accessToken: string = '';
  private refreshToken: string = '';
  private tokenExpiry: number = 0;

  constructor(config: MijiaConfig) {
    super();
    this.config = config;
  }

  /**
   * 生成授权 URL
   */
  getAuthorizationUrl(): string {
    const url = new URL(this.config.authUrl);
    url.searchParams.set('client_id', this.config.appId);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', this.config.redirectUri);
    url.searchParams.set('scope', 'device_info device_control');
    return url.toString();
  }

  /**
   * 用授权码换取 access_token
   */
  async exchangeCodeForToken(code: string): Promise<MijiaTokenResponse> {
    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        redirect_uri: this.config.redirectUri,
        code,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to exchange code: ${response.statusText}`);
    }

    const tokenData = (await response.json()) as MijiaTokenResponse;
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;
    this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;

    return tokenData;
  }

  /**
   * 刷新 access_token
   */
  async refreshAccessToken(): Promise<void> {
    if (!this.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await fetch(this.config.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: this.config.appId,
        client_secret: this.config.appSecret,
        refresh_token: this.refreshToken,
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.statusText}`);
    }

    const tokenData = (await response.json()) as MijiaTokenResponse;
    this.accessToken = tokenData.access_token;
    this.refreshToken = tokenData.refresh_token;
    this.tokenExpiry = Date.now() + tokenData.expires_in * 1000;
  }

  /**
   * 确保 token 有效，过期则自动刷新
   */
  private async ensureValidToken(): Promise<string> {
    if (!this.accessToken) {
      throw new Error('Not authenticated. Please complete OAuth flow first.');
    }

    if (Date.now() > this.tokenExpiry - 60000) {
      await this.refreshAccessToken();
    }

    return this.accessToken;
  }

  /**
   * 从米家 API 获取设备列表
   */
  async getDevices(): Promise<Device[]> {
    const token = await this.ensureValidToken();

    const response = await fetch(`${this.config.apiUrl}/home/device_list`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch device list: ${response.statusText}`);
    }

    const data = (await response.json()) as MijiaDeviceListResponse;
    if (data.code !== 0) {
      throw new Error(`API error: ${data.message}`);
    }

    return data.result.list.map(this.mapMijiaDevice);
  }

  /**
   * 从 API 获取设备状态（替代 Mock）
   */
  async getDeviceState(deviceId: string): Promise<DeviceState> {
    const token = await this.ensureValidToken();

    const response = await fetch(`${this.config.apiUrl}/home/devicestate`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ did: deviceId }),
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch device state: ${response.statusText}`);
    }

    const data = (await response.json()) as { result?: { props?: Record<string, unknown> } };
    const props = data.result?.props || {};
    return {
      deviceId,
      power: props.power === 'on',
      brightness: props.brightness as number | undefined,
      temperature: props.temperature as number | undefined,
      humidity: props.humidity as number | undefined,
      mode: props.mode as string | undefined,
    };
  }

  /**
   * 通过 API 控制设备（替代 Mock）
   */
  async setDeviceState(deviceId: string, state: Partial<DeviceState>): Promise<boolean> {
    const token = await this.ensureValidToken();

    const response = await fetch(`${this.config.apiUrl}/home/devicecmd`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        did: deviceId,
        props: state,
      }),
    });

    if (!response.ok) {
      console.error(`Failed to control device ${deviceId}: ${response.statusText}`);
      return false;
    }

    const data = (await response.json()) as { code: number };
    return data.code === 0;
  }

  /**
   * 将米家原始设备数据映射为平台统一格式
   */
  private mapMijiaDevice(raw: MijiaRawDevice): Device {
    let deviceType = 'switch';
    const model = raw.model.toLowerCase();
    if (model.includes('light') || model.includes('bulb') || model.includes('lamp')) {
      deviceType = 'light';
    } else if (model.includes('ac') || model.includes('aircon')) {
      deviceType = 'airconditioner';
    } else if (model.includes('sensor')) {
      deviceType = 'sensor';
    } else if (model.includes('purifier')) {
      deviceType = 'airpurifier';
    }

    return {
      id: raw.did,
      name: raw.name,
      brand: 'mijia',
      type: deviceType,
      model: raw.model,
      status: 'online',
      connectionType: raw.ssid ? 'wifi' : 'bluetooth',
      ipAddress: undefined,
      macAddress: raw.mac,
      lastSyncTime: new Date().toISOString(),
      firmwareVersion: undefined,
      config: JSON.stringify({ pid: raw.pid, pmodel: raw.pmodel, sn: raw.sn }),
    };
  }
}
