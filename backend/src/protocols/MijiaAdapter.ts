/**
 * ⚠️ 注意：此适配器为演示实现，未接入真实米家开放平台 API。
 * 如需真实接入，需实现米家 OAuth 认证和 API 调用。
 */
import { ProtocolAdapter, Device, DeviceState } from '../types';

export class MijiaAdapter implements ProtocolAdapter {
  brand = 'mijia';

  async discoverDevices(): Promise<Device[]> {
    // 未接入真实 API，返回空列表
    return [];
  }

  async getDeviceState(_deviceId: string): Promise<DeviceState> {
    throw new Error('米家适配器未接入真实 API，无法获取设备状态');
  }

  async setDeviceState(_deviceId: string, _state: Partial<DeviceState>): Promise<boolean> {
    throw new Error('米家适配器未接入真实 API，无法控制设备');
  }

  async updateFirmware(_deviceId: string, _version: string): Promise<boolean> {
    throw new Error('米家适配器未接入真实 API，无法更新固件');
  }
}
