// Shared SerialPort contract & WebUSB CDC-ACM transport for ESP32 devices
// Based on ESP-WebSDR (https://github.com/ESPARGOS/esp-web-sdr)

export const ESP_USB_VENDOR_ID = 0x303a;

/**
 * Identify native CDC endpoints in USB configuration descriptor.
 * Native Espressif CDC functions use adjacent control/data interfaces.
 * Never claim the vendor-specific JTAG or streaming interface.
 */
function findCdcEndpoints(config: any) {
  for (const control of config.interfaces) {
    for (const ca of control.alternates) {
      if (ca.interfaceClass !== 2 || ca.interfaceSubclass !== 2) continue;
      const data = config.interfaces.find(
        (i: any) => i.interfaceNumber === control.interfaceNumber + 1
      );
      for (const da of data?.alternates || []) {
        if (da.interfaceClass !== 10) continue;
        const input = da.endpoints.find(
          (e: any) => e.type === 'bulk' && e.direction === 'in'
        );
        const output = da.endpoints.find(
          (e: any) => e.type === 'bulk' && e.direction === 'out'
        );
        if (input && output) return { control, ca, data, da, input, output };
      }
    }
  }
  throw new Error(
    'This Espressif device has no native CDC serial interface. Use its native USB connector and enable CDC firmware or BOOT mode.'
  );
}

function checkUsbResult(result: any, operation: string) {
  if (result.status !== 'ok') {
    throw new Error(`${operation}: USB ${result.status}`);
  }
}

/**
 * Emulates the WebSerial `SerialPort` interface over WebUSB using CDC ACM protocol.
 */
export class NativeUSBPort {
  device: any;
  kind = 'webusb';
  readable: ReadableStream<Uint8Array> | null = null;
  writable: WritableStream<Uint8Array> | null = null;
  signals = { dataTerminalReady: false, requestToSend: false };
  private controls: Promise<any> = Promise.resolve();
  private session: any = null;
  private endpoints: any = null;

  constructor(device: any) {
    if (device.vendorId !== ESP_USB_VENDOR_ID) {
      throw new Error('WebUSB supports only native Espressif USB devices (VID 0x303A).');
    }
    this.device = device;
  }

  getInfo() {
    return {
      usbVendorId: this.device.vendorId,
      usbProductId: this.device.productId
    };
  }

  async open({
    baudRate = 115200,
    dataBits = 8,
    stopBits = 1,
    parity = 'none',
    flowControl = 'none',
    bufferSize = 131072
  }: any = {}) {
    if (this.session) throw new Error('USB port is already open.');
    if (dataBits !== 8 || stopBits !== 1 || parity !== 'none' || flowControl !== 'none') {
      throw new Error('Native USB supports 8N1 without hardware flow control.');
    }
    const device = this.device;
    try {
      await device.open();
      if (!device.configuration) {
        await device.selectConfiguration(device.configurations[0].configurationValue);
      }
      this.endpoints = findCdcEndpoints(device.configuration);
      const { control, ca, data, da } = this.endpoints;
      for (const [iface, alternate] of [[control, ca], [data, da]]) {
        try {
          await device.claimInterface(iface.interfaceNumber);
        } catch (cause: any) {
          const message =
            'WebUSB cannot claim the native USB serial interface. Another application or the operating system driver may own it. ' +
            'On desktop Linux, the cdc_acm driver normally owns this interface: choose WebSerial instead, or temporarily detach that device’s CDC driver to test WebUSB. ' +
            'This page cannot detach OS drivers; BOOT mode does not resolve driver ownership.';
          throw Object.assign(new Error(message), { code: 'USB_INTERFACE_UNAVAILABLE', cause });
        }
        if (iface.alternate.alternateSetting !== alternate.alternateSetting) {
          await device.selectAlternateInterface(iface.interfaceNumber, alternate.alternateSetting);
        }
      }
      this.signals = { dataTerminalReady: false, requestToSend: false };
      await this.setBaudRate(baudRate);
      // CDC firmware (including S2 TinyUSB) waits for DTR before transmitting.
      await this.setSignals({ dataTerminalReady: true, requestToSend: false });
      this.createStreams();
    } catch (e: any) {
      await device.close().catch(() => {});
      if (e.code === 'USB_INTERFACE_UNAVAILABLE') throw e;
      throw new Error(
        `Cannot open native USB: ${e.message}. Close other device clients. If the OS owns the CDC interface, use WebSerial on that host.`,
        { cause: e }
      );
    }
  }

  private control(request: number, value: number, data?: BufferSource) {
    const operation = this.controls.then(async () => {
      checkUsbResult(
        await this.device.controlTransferOut(
          {
            requestType: 'class',
            recipient: 'interface',
            request,
            value,
            index: this.endpoints.control.interfaceNumber
          },
          data
        ),
        'CDC control'
      );
    });
    this.controls = operation.catch(() => {});
    return operation;
  }

  setBaudRate(baudRate: number) {
    if (!Number.isInteger(baudRate) || baudRate <= 0 || baudRate > 0xffffffff) {
      throw new Error('Invalid baud rate.');
    }
    const data = new Uint8Array(7);
    new DataView(data.buffer).setUint32(0, baudRate, true);
    data[6] = 8;
    return this.control(0x20, 0, data);
  }

  async setSignals(signals: { dataTerminalReady?: boolean; requestToSend?: boolean; break?: boolean }) {
    this.signals = { ...this.signals, ...signals };
    if (signals.dataTerminalReady !== undefined || signals.requestToSend !== undefined) {
      await this.control(
        0x22,
        (this.signals.dataTerminalReady ? 1 : 0) | (this.signals.requestToSend ? 2 : 0)
      );
    }
    if (signals.break !== undefined) {
      await this.control(0x23, signals.break ? 0xffff : 0);
    }
  }

  private createStreams() {
    const session: any = { active: true, reader: null, closing: null };
    this.session = session;
    const { input, output } = this.endpoints;
    const device = this.device;
    const pending: Promise<any>[] = [];

    const fill = () => {
      while (session.active && pending.length < 8) {
        pending.push(
          device
            .transferIn(input.endpointNumber, input.packetSize)
            .then((result: any) => ({ result }), (error: any) => ({ error }))
        );
      }
    };

    this.readable = new ReadableStream<Uint8Array>({
      start: (controller) => {
        session.reader = controller;
      },
      pull: async (controller) => {
        try {
          while (session.active) {
            fill();
            const { result, error } = await pending.shift();
            if (!session.active) return;
            if (error) throw error;
            checkUsbResult(result, 'CDC read');
            if (result.data?.byteLength) {
              controller.enqueue(
                new Uint8Array(result.data.buffer, result.data.byteOffset, result.data.byteLength)
              );
              return;
            }
          }
        } catch (e) {
          if (session.active) {
            controller.error(e);
            await this.close();
          }
        }
      },
      cancel: () => {
        session.reader = null;
        return this.close();
      }
    });

    this.writable = new WritableStream<Uint8Array>({
      write: async (bytes: Uint8Array) => {
        if (!session.active) throw new Error('USB port is closed.');
        const result = await device.transferOut(output.endpointNumber, bytes);
        checkUsbResult(result, 'CDC write');
        if (result.bytesWritten !== bytes.byteLength) {
          throw new Error('Incomplete CDC write.');
        }
      }
    });
  }

  async close() {
    const session = this.session;
    if (!session) return;
    if (session.closing) return session.closing;
    session.active = false;
    try {
      session.reader?.close();
    } catch {}
    this.readable = null;
    this.writable = null;
    session.closing = this.device.close().finally(() => {
      if (this.session === session) this.session = null;
    });
    return session.closing;
  }
}

const deviceCache = new WeakMap<any, NativeUSBPort>();
function wrapDevice(device: any): NativeUSBPort {
  if (!deviceCache.has(device)) {
    deviceCache.set(device, new NativeUSBPort(device));
  }
  return deviceCache.get(device)!;
}

/**
 * Universal serial connection manager: chooses WebUSB on mobile (Android)
 * or WebSerial on desktop, with graceful fallbacks.
 */
export class SerialConnection {
  static isSupported(): boolean {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as any;
    return !!(nav.serial || nav.usb);
  }

  static isWebSerialSupported(): boolean {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  static isWebUsbSupported(): boolean {
    return typeof navigator !== 'undefined' && 'usb' in navigator;
  }

  static isMobile(): boolean {
    if (typeof navigator === 'undefined') return false;
    const nav = navigator as any;
    if (nav.userAgentData?.mobile !== undefined) return nav.userAgentData.mobile;
    return (
      /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '') ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)
    );
  }

  static defaultTransport(): 'webusb' | 'webserial' {
    const nav = typeof navigator !== 'undefined' ? (navigator as any) : null;
    if (!nav) return 'webserial';
    // Always prefer WebSerial if supported (on both desktop and mobile/Android)
    // Because WebSerial accesses serial without low-level USB cdc_acm kernel claim conflicts!
    if (nav.serial) {
      return 'webserial';
    }
    if (nav.usb) {
      return 'webusb';
    }
    return 'webserial';
  }

  static async requestPort(transport?: 'webusb' | 'webserial'): Promise<any> {
    const target = transport || SerialConnection.defaultTransport();
    const nav = navigator as any;

    if (target === 'webusb') {
      if (!nav.usb) {
        throw new Error(
          'WebUSB is unavailable in this browser. Please ensure you are using Chrome on Android over HTTPS or localhost.'
        );
      }
      const device = await nav.usb.requestDevice({
        filters: [{ vendorId: ESP_USB_VENDOR_ID }]
      });
      return wrapDevice(device);
    }

    if (!nav.serial) {
      if (nav.usb) {
        const device = await nav.usb.requestDevice({
          filters: [{ vendorId: ESP_USB_VENDOR_ID }]
        });
        return wrapDevice(device);
      }
      throw new Error('Neither WebSerial nor WebUSB is available in this browser.');
    }

    return await nav.serial.requestPort();
  }

  static async getPorts(transport?: 'webusb' | 'webserial'): Promise<any[]> {
    const target = transport || SerialConnection.defaultTransport();
    const nav = navigator as any;
    if (target === 'webusb') {
      if (!nav.usb) return [];
      const devices = await nav.usb.getDevices();
      return devices.filter((d: any) => d.vendorId === ESP_USB_VENDOR_ID).map(wrapDevice);
    }
    if (!nav.serial) return [];
    return await nav.serial.getPorts();
  }
}
