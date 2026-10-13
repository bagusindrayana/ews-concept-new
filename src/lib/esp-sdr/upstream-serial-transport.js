// Shared SerialPort contract for the receiver and esptool-js. WebSerial ports
// already implement it; NativeUSBPort implements CDC ACM over WebUSB.
(function(root){
 'use strict';
 const vendorId=0x303a;
 function cdc(config){
  // Native Espressif CDC functions use adjacent control/data interfaces.
  // Never claim the vendor-specific JTAG or streaming interface.
  for(const control of config.interfaces)for(const ca of control.alternates){
   if(ca.interfaceClass!==2||ca.interfaceSubclass!==2)continue;
   const data=config.interfaces.find(i=>i.interfaceNumber===control.interfaceNumber+1);
   for(const da of data?.alternates||[]){
    if(da.interfaceClass!==10)continue;
    const input=da.endpoints.find(e=>e.type==='bulk'&&e.direction==='in');
    const output=da.endpoints.find(e=>e.type==='bulk'&&e.direction==='out');
    if(input&&output)return {control,ca,data,da,input,output};
   }
  }
  throw Error('This Espressif device has no native CDC serial interface. Use its native USB connector and enable CDC firmware or BOOT mode.');
 }
 function check(result,operation){if(result.status!=='ok')throw Error(`${operation}: USB ${result.status}`);}
 class NativeUSBPort {
  constructor(device){
   if(device.vendorId!==vendorId)throw Error('WebUSB supports only native Espressif USB devices.');
   this.device=device;this.kind='webusb';this.readable=null;this.writable=null;
   this.signals={dataTerminalReady:false,requestToSend:false};this.controls=Promise.resolve();this.session=null;
  }
  getInfo(){return {usbVendorId:this.device.vendorId,usbProductId:this.device.productId};}
  async open({baudRate=115200,dataBits=8,stopBits=1,parity='none',flowControl='none'}={}){
   if(this.session)throw Error('USB port is already open.');
   if(dataBits!==8||stopBits!==1||parity!=='none'||flowControl!=='none')throw Error('Native USB supports 8N1 without hardware flow control.');
   const device=this.device;
   try{
    await device.open();
    if(!device.configuration)await device.selectConfiguration(device.configurations[0].configurationValue);
    this.endpoints=cdc(device.configuration);
    const {control,ca,data,da}=this.endpoints;
    for(const [iface,alternate] of [[control,ca],[data,da]]){
     try{await device.claimInterface(iface.interfaceNumber);}
     catch(cause){
      const message='WebUSB cannot claim the native USB serial interface. Another application or the operating system driver may own it. '+
       'On desktop Linux, the cdc_acm driver normally owns this interface: choose WebSerial instead, or temporarily detach that device’s CDC driver to test WebUSB. '+
       'This page cannot detach OS drivers; BOOT mode does not resolve driver ownership.';
      throw Object.assign(Error(message,{cause}),{code:'USB_INTERFACE_UNAVAILABLE'});
     }
     if(iface.alternate.alternateSetting!==alternate.alternateSetting)await device.selectAlternateInterface(iface.interfaceNumber,alternate.alternateSetting);
    }
    this.signals={dataTerminalReady:false,requestToSend:false};
    await this.setBaudRate(baudRate);
    // CDC firmware (including S2 TinyUSB) waits for DTR before transmitting.
    await this.setSignals({dataTerminalReady:true,requestToSend:false});
    this.createStreams();
   }catch(e){await device.close().catch(()=>{});if(e.code==='USB_INTERFACE_UNAVAILABLE')throw e;throw Error(`Cannot open native USB: ${e.message}. Close other device clients. If the OS owns the CDC interface, use WebSerial on that host.`,{cause:e});}
  }
  control(request,value,data){
   const operation=this.controls.then(async()=>{
    check(await this.device.controlTransferOut({requestType:'class',recipient:'interface',request,value,index:this.endpoints.control.interfaceNumber},data),'CDC control');
   });
   this.controls=operation.catch(()=>{});return operation;
  }
  setBaudRate(baudRate){
   if(!Number.isInteger(baudRate)||baudRate<=0||baudRate>0xffffffff)throw Error('Invalid baud rate.');
   const data=new Uint8Array(7);new DataView(data.buffer).setUint32(0,baudRate,true);data[6]=8;
   return this.control(0x20,0,data);
  }
  async setSignals(signals){
   this.signals={...this.signals,...signals};
   if(signals.dataTerminalReady!==undefined||signals.requestToSend!==undefined)
    await this.control(0x22,(this.signals.dataTerminalReady?1:0)|(this.signals.requestToSend?2:0));
   if(signals.break!==undefined)await this.control(0x23,signals.break?0xffff:0);
  }
  createStreams(){
   const session={active:true};this.session=session;
   const {input,output}=this.endpoints,device=this.device;
   const pending=[];
   const fill=()=>{
    // Keep a small, bounded pipeline of single-packet transfers. Larger USB
    // requests can hang on replies ending at an exact packet boundary; one
    // request at a time unnecessarily serializes browser/USB round trips.
    while(session.active&&pending.length<8)pending.push(device.transferIn(input.endpointNumber,input.packetSize)
     .then(result=>({result}),error=>({error})));
   };
   this.readable=new ReadableStream({
    start:controller=>{session.reader=controller;},
    pull:async controller=>{
     try{
      while(session.active){
       fill();
       const {result,error}=await pending.shift();
       if(!session.active)return;
       if(error)throw error;
       check(result,'CDC read');
       if(result.data?.byteLength){controller.enqueue(new Uint8Array(result.data.buffer,result.data.byteOffset,result.data.byteLength));return;}
      }
     }catch(e){if(session.active){controller.error(e);await this.close();}}
    },
    cancel:()=>{session.reader=null;return this.close();}
   });
   this.writable=new WritableStream({write:async bytes=>{
    if(!session.active)throw Error('USB port is closed.');
    const result=await device.transferOut(output.endpointNumber,bytes);check(result,'CDC write');
    if(result.bytesWritten!==bytes.byteLength)throw Error('Incomplete CDC write.');
   }});
  }
  async close(){
   const session=this.session;
   if(!session)return;
   if(session.closing)return session.closing;
   session.active=false;
   try{session.reader?.close();}catch{}
   this.readable=null;this.writable=null;
   // USBDevice.close cancels pending transfers and releases all claimed
   // interfaces. Waiting for an idle bulk read before closing would deadlock.
   session.closing=this.device.close().finally(()=>{if(this.session===session)this.session=null;});
   return session.closing;
  }
 }
 const cache=new WeakMap();
 const wrap=device=>{if(!cache.has(device))cache.set(device,new NativeUSBPort(device));return cache.get(device);};
 root.SerialConnection={
  NativeUSBPort,
  supported:()=>!!(navigator.serial||navigator.usb),
  defaultKind:()=>{
   const mobile=navigator.userAgentData?.mobile??(/Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent||'')||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1));
   const preferred=mobile?'webusb':'webserial';
   return navigator[preferred==='webusb'?'usb':'serial']?preferred:navigator.serial?'webserial':'webusb';
  },
  kind:port=>port.kind||'webserial',
  async requestPort(kind=this.defaultKind()){
   if(kind==='webusb'){
    if(!navigator.usb)throw Error('WebUSB is unavailable. Use a browser with WebUSB support over HTTPS or localhost.');
    return wrap(await navigator.usb.requestDevice({filters:[{vendorId}]}));
   }
   if(!navigator.serial)throw Error('WebSerial is unavailable. Choose native USB (WebUSB).');
   return navigator.serial.requestPort();
  },
  async getPorts(kind=this.defaultKind()){
   if(kind==='webusb')return navigator.usb?(await navigator.usb.getDevices()).filter(d=>d.vendorId===vendorId).map(wrap):[];
   return navigator.serial? navigator.serial.getPorts():[];
  },
  async reconnect(port){
   if(this.kind(port)!=='webusb')return port;
   const previous=port.device,devices=await navigator.usb.getDevices();
   const matches=devices.filter(d=>d===previous||(previous.serialNumber&&d.serialNumber===previous.serialNumber&&d.vendorId===previous.vendorId&&d.productId===previous.productId));
   if(matches.length!==1)throw Error('USB device disconnected or changed identity. Choose the device again.');
   return wrap(matches[0]);
  },
  onConnect(callback){for(const api of [navigator.serial,navigator.usb])api?.addEventListener?.('connect',callback);}
 };
})(globalThis);

