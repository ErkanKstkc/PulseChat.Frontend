import * as signalR from '@microsoft/signalr';

export interface ChatMessageDto {
  id: string;
  roomId: string;
  senderId: string;
  clientMessageId: string;
  type: string;
  content: string;
  mediaUrl?: string | null;
  createdAt: string;
}

export interface MessageAckDto {
  clientMessageId: string;
  serverMessageId: string;
  deliveredAt: string;
}

export interface TypingNotificationDto {
  roomId: string;
  userId: string;
}

export interface PresenceNotificationDto {
  userId: string;
  status?: string;
  isOnline?: boolean;
  timestamp?: string;
  lastSeen?: string;
}

export interface MessagesReadNotificationDto {
  roomId: string;
  userId: string;
  readAt: string;
}

class SignalRService {
  private connection: signalR.HubConnection | null = null;
  private currentRoomId: string | null = null;

  public async startConnection(token: string): Promise<signalR.HubConnection> {
    if (this.connection && this.connection.state === signalR.HubConnectionState.Connected) {
      return this.connection;
    }

    const hubUrl = process.env.NEXT_PUBLIC_SIGNALR_URL || 'http://localhost:5000/hubs/chat';

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl(hubUrl, {
        accessTokenFactory: () => token,
        transport: signalR.HttpTransportType.WebSockets | signalR.HttpTransportType.LongPolling,
      })
      .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
      .configureLogging(signalR.LogLevel.Warning)
      .build();

    await this.connection.start();
    console.log('[SignalR] Connected to ChatHub successfully.');

    // Rejoin current room if connection drops and reconnects
    this.connection.onreconnected(async () => {
      console.log('[SignalR] Reconnected. Rejoining active room if needed.');
      if (this.currentRoomId) {
        await this.joinRoom(this.currentRoomId);
      }
    });

    return this.connection;
  }

  public async stopConnection(): Promise<void> {
    if (this.connection) {
      await this.connection.stop();
      this.connection = null;
      this.currentRoomId = null;
    }
  }

  public async joinRoom(roomId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;

    if (this.currentRoomId && this.currentRoomId !== roomId) {
      await this.leaveRoom(this.currentRoomId);
    }

    this.currentRoomId = roomId;
    await this.connection.invoke('JoinRoom', roomId);
    console.log(`[SignalR] Joined room: ${roomId}`);
  }

  public async leaveRoom(roomId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('LeaveRoom', roomId);
    if (this.currentRoomId === roomId) {
      this.currentRoomId = null;
    }
    console.log(`[SignalR] Left room: ${roomId}`);
  }

  public async sendMessage(
    roomId: string,
    clientMessageId: string,
    content: string,
    type: string = 'Text',
    mediaUrl?: string | null
  ): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) {
      throw new Error('SignalR is not connected');
    }

    await this.connection.invoke('SendMessage', {
      roomId,
      clientMessageId,
      content,
      type,
      mediaUrl: mediaUrl || null,
    });
  }

  public async sendTyping(roomId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    await this.connection.invoke('SendTyping', roomId);
  }

  public async markAsRead(roomId: string): Promise<void> {
    if (!this.connection || this.connection.state !== signalR.HubConnectionState.Connected) return;
    try {
      await this.connection.invoke('MarkAsRead', roomId);
    } catch (err) {
      console.warn('[SignalR] Failed to invoke MarkAsRead:', err);
    }
  }

  public onReceiveMessage(callback: (message: ChatMessageDto) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('ReceiveMessage', callback);
    return () => this.connection?.off('ReceiveMessage', callback);
  }

  public onMessageDeliveredAck(callback: (ack: MessageAckDto) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('MessageDeliveredAck', callback);
    return () => this.connection?.off('MessageDeliveredAck', callback);
  }

  public onUserTyping(callback: (notification: TypingNotificationDto) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('UserTyping', callback);
    return () => this.connection?.off('UserTyping', callback);
  }

  public onUserPresenceChanged(callback: (notification: PresenceNotificationDto) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('UserPresenceChanged', callback);
    return () => this.connection?.off('UserPresenceChanged', callback);
  }

  public onMessagesRead(callback: (notification: MessagesReadNotificationDto) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('MessagesRead', callback);
    return () => this.connection?.off('MessagesRead', callback);
  }

  public onError(callback: (error: string) => void): () => void {
    if (!this.connection) return () => {};
    this.connection.on('Error', callback);
    return () => this.connection?.off('Error', callback);
  }

  public getConnectionState(): signalR.HubConnectionState {
    return this.connection ? this.connection.state : signalR.HubConnectionState.Disconnected;
  }
}

export const signalRService = new SignalRService();
