import {
  MessageBody,
  SubscribeMessage,
  WebSocketGateway,
  ConnectedSocket,
  OnGatewayDisconnect,
} from '@nestjs/websockets';

import { Socket } from 'socket.io';
import { LoginDto, MsgDto } from './schemas.dto';
import { Logger } from '@nestjs/common';
import { S3Service } from './s3/s3.service';

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  transports: ['websocket'],
})
export class Gateway implements OnGatewayDisconnect {
  private readonly log = new Logger(Gateway.name);

  constructor(private readonly s3: S3Service) {}

  private async wrapped_emit(socket: Socket, event: string, ...args: any[]) {
    return await socket
      .timeout(1000)
      .emitWithAck(event, ...args)
      .catch(() => {
        this.removeSocketIdFromMap(socket.id);
        return 'fail';
      })
      .then(() => 'success');
  }

  usernameSocketMap = new Map<string, Socket>();
  socketIdUsernameMap = new Map<string, string>();

  async handleMsg(data: MsgDto, sender: Socket) {
    // here the fuction will get something like {"type":"file/message", "to": "clientId", "content":""}
    // if this fails, this means that the desinatary client is offline and the sender will be notified about this
    const { to_username, msg_hash, content, type, file_name } = data;
    const toSocket = this.usernameSocketMap.get(to_username);
    if (!toSocket) {
      await this.wrapped_emit(sender, 'offline_recipient', {
        msg_hash: msg_hash,
      });
      this.log.log('returning ack');
      return;
    }
    const from_username =
      this.socketIdUsernameMap.get(sender.id) || 'anonymous sender';
    switch (type) {
      case 'msg':
        const sendResult = await this.wrapped_emit(toSocket, 'msg', {
          content: content,
          type: type,
          from_username: from_username,
          msg_hash: msg_hash,
        });

        if (sendResult === 'fail') {
          await this.wrapped_emit(sender, 'offline_recipient', {
            msg_hash: msg_hash,
          });
        } else {
          await this.wrapped_emit(sender, 'msg_sent', { msg_hash: msg_hash });
        }
        return;
      case 'file':
        const uploadResult = await this.s3.uploadFile(
          to_username,
          file_name,
          content,
        );
        if (uploadResult === 'fail') {
          await this.wrapped_emit(sender, 'file_upload_fail', {
            msg_hash: msg_hash,
          });
          this.log.warn(`upload file ${file_name} failed`);
          return;
        }
        this.log.log(`upload file ${file_name} ok`);

        const sendFileResult = await this.wrapped_emit(toSocket, 'msg', {
          content: '/' + to_username + '/' + file_name,
          type: 'file',
          from_username: from_username,
          msg_hash: msg_hash,
        });

        if (sendFileResult === 'fail') {
          await this.wrapped_emit(sender, 'offline_recipient', {
            msg_hash: msg_hash,
          });
        }
        await this.wrapped_emit(sender, 'msg_sent', { msg_hash: msg_hash });
        break;
    }
  }

  @SubscribeMessage('msg')
  msg(@MessageBody() data: MsgDto, @ConnectedSocket() sender: Socket) {
    this.handleMsg(data, sender);
    return true;
  }

  @SubscribeMessage('login')
  login(@MessageBody() data: LoginDto, @ConnectedSocket() client: Socket) {
    // here the fuction will get something like {"type":"file/message", "to": "clientId", "content":""}
    // if this fails, this means that the desinatary client is offline and the sender will be notified about this
    this.removeSocketIdFromMap(client.id);
    this.usernameSocketMap.set(data.user_name, client);
    this.socketIdUsernameMap.set(client.id, data.user_name);
    this.log.log(`User ${data.user_name} logged in with id: ${client.id}`);
    return true;
  }

  handleDisconnect(client: Socket) {
    this.removeSocketIdFromMap(client.id);
  }

  private removeSocketIdFromMap(socketId: string) {
    if (!this.socketIdUsernameMap.has(socketId)) return;
    const username = this.socketIdUsernameMap.get(socketId);
    this.socketIdUsernameMap.delete(socketId);
    this.usernameSocketMap.delete(username);
    const avClients = [];
    for (const [username, _] of this.usernameSocketMap.entries()) {
      avClients.push(username);
    }
    this.log.log(
      `User ${username} logged out. Connected clients: ${avClients.join(', ')}`,
    );
  }
}
