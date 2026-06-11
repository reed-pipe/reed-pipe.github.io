# Xiaomi Watch S5 (miwear) 表盘推送 —— 协议规格与实现交接

> 状态：**WIP / 未完成**。逆向已完成、加密与 protobuf 地基已写，但**完整工具需要拿着手表联调**才能跑通（见末尾「为什么没做完」）。本目录未接入路由，不是可用功能。

逆向自「表盘自定义工具」APK 原生层 `com.givemefive.ble.xiaomi.*`，其协议 = **Gadgetbridge 开源小米协议**（`nodomain.freeyourgadget.gadgetbridge.proto.xiaomi`）。可对照 Gadgetbridge 源码（XiaomiSupport / XiaomiAuthService / XiaomiCharacteristic / XiaomiDataUploadService / XiaomiWatchfaceService）。

## 1. BLE 拓扑
- 服务基址 Bluetooth 标准：`0000XXXX-0000-1000-8000-00805f9b34fb`
- 4 个通道特征：`0x0051`（命令写）、`0x0052`、`0x0053`、`0x0055`（来自 util.m / d5.b）
- 设备信息特征：`0x0016`/`0x0017`
- 收发都经「分包(chunked)」协议（见 §3）

## 2. 认证握手（已实现于 miwear/crypto.ts）
设备密钥(IKM) = 手环 authkey（用户 S5 = `5223b3966cefc8d227b2b14bc173975d`，从小米健康日志提取）。
1. 手机发 PhoneNonce(16B 随机)：Command{type=1,subtype=26,auth{phoneNonce{nonce}}}，**明文**
2. 手表回 WatchNonce{nonce,hmac}
3. 派生：`HKDF-SHA256(IKM=key, salt=phoneNonce‖watchNonce, info="miwear-auth", L=64)`
   → decKey[0:16] encKey[16:32] decNonce[32:36] encNonce[36:40]
4. 校验 `watchNonce.hmac == HMAC-SHA256(decKey, watchNonce‖phoneNonce)`
5. 发 AuthStep3{ encryptedNonces=HMAC(encKey, phoneNonce‖watchNonce),
   encryptedDeviceInfo=**CCM**(encKey, deviceInfoProto) }：Command{type=1,subtype=27}

## 3. 会话加密（关键：AES-CCM，Web Crypto 不支持，需手写）
- 加密 `o(data, seq)`：AES/CCM，key=encKey，**nonce(12B,LE)= encNonce(4) ‖ int32(0) ‖ int16(seq) ‖ int16(0)**，MAC=32bit 附在密文后
- 解密 `k(data)`：AES/CCM，key=decKey，**nonce(12B,LE)= decNonce(4) ‖ int32(0) ‖ int32(0)**
- `seq` = 发送命令计数器
- （另有 `m()/q()` 为 AES-CTR(key==IV)，主流程用 CCM）

## 4. 分包协议（XiaomiCharacteristic，见 k.java）
小包单发；大包分块。控制字节在 `[00 00]` 前缀后：
- `[00 00][00][encFlag][numChunks:int16]` = 分块开始
- `[chunkIndex:int16][payload]` = 数据块（index 从 1）
- `[00 00][02][encFlag][payload]` = 单包消息
- `[00 00][01][subtype]` = ack（subtype 0=end,1=start,2=tack）
- 固定 ack 字节触发发下一包
- 收齐后若 encFlag：先 CCM 解密再 `Command.parseFrom`

## 5. protobuf 字段号（见 miwear/proto.ts，已实现需要的部分）
- Command: type=1,subtype=2,auth=3,watchface=6,dataUpload=24,status=100
- Auth: phoneNonce=30,watchNonce=31,authStep3=32 | WatchNonce: nonce=1,hmac=2 | AuthStep3: encNonces=1,encDevInfo=2
- DataUpload: dataUploadRequest=1,dataUploadAck=2 | Request: type=1,md5Sum=2,size=3 | Ack: md5Sum=1,resumePosition=4,chunkSize=5(默认2048)
- Watchface: watchfaceList=1,watchfaceId=2,installStatus=5,installStart=6,installFinish=7

## 6. 表盘推送流程（DataUpload + Watchface，见 m.java/o.java/u.java）
1. 认证后，请求表盘列表（Command type=20,subtype=...）
2. DataUploadRequest{type=watchface, md5Sum=MD5(face), size} → 手表回 DataUploadAck{chunkSize,resumePosition}
3. 按 chunkSize 分块上传 .face（每块经 §3/§4 发送）
4. 安装：Watchface installStart/installFinish；轮询 installStatus
- 需要 **MD5**（Web Crypto 无 MD5，需 JS 实现）

## 7. 表盘 .face 二进制格式（见 com.givemefive.mi8wf.pack）
- magic `5aa53412`
- FaceHeader：bgImgIndex@int16(0), bgImgGroup@int8(3), preview_offset@int32(4)，随后 10 组 Element{count@int32, offset@int32}
- 元素/图片/控件/动画 POJO：Element/ImageDefPojo/ImageWriter/WfWriter/AnimDefPojo/EditableWidgeDef/JsDefPojo
- 反向解析参考 `WatchfaceReaderAll`

## 8. 剩余工作（要拿手表联调）
- [ ] 手写 AES-CCM（CTR+CBC-MAC，32bit tag）
- [ ] Web Bluetooth 传输：连接 + 4 特征 + 分包状态机（§4）+ CCM 包裹（§3）
- [ ] 认证编排（§2）→ **里程碑：连接+认证成功**（手表一秒可判定）
- [ ] DataUpload 推 .face（§6）+ JS MD5
- [ ] mi8wf 表盘生成/编辑器（§7）

## 为什么没在本环境做完
这是**加密的、分包的、逆向得来的 BLE 协议**。CCM nonce/分包/时序任何字节错位 → 手表静默拒绝。而本开发环境**无法连接手表、无法观察手表响应、无法迭代调试**。这类协议**必须小步上机验证**。地基（crypto/proto，可用测试向量验证）已就绪；其余需在能连手表的环境里按本规格逐步联调。
