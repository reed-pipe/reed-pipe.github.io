// 最小 Web Bluetooth 类型声明（仅覆盖本模块用到的 API）
interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly uuid: string
  readonly value?: DataView
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  writeValueWithResponse(value: BufferSource): Promise<void>
  writeValueWithoutResponse(value: BufferSource): Promise<void>
  getDescriptor?(uuid: string): Promise<unknown>
}
interface BluetoothRemoteGATTService {
  readonly uuid: string
  getCharacteristic(uuid: string | number): Promise<BluetoothRemoteGATTCharacteristic>
  getCharacteristics(): Promise<BluetoothRemoteGATTCharacteristic[]>
}
interface BluetoothRemoteGATTServer {
  readonly connected: boolean
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(uuid: string | number): Promise<BluetoothRemoteGATTService>
  getPrimaryServices(): Promise<BluetoothRemoteGATTService[]>
}
interface BluetoothDevice extends EventTarget {
  readonly id: string
  readonly name?: string
  readonly gatt?: BluetoothRemoteGATTServer
}
interface RequestDeviceOptions {
  filters?: Array<{ services?: (string | number)[]; name?: string; namePrefix?: string }>
  optionalServices?: (string | number)[]
  acceptAllDevices?: boolean
}
interface Bluetooth {
  getAvailability(): Promise<boolean>
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>
}
interface Navigator { readonly bluetooth: Bluetooth }
