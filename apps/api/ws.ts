import { WebSocketServer, WebSocket } from 'ws'
import { Server } from 'http'

let wss: WebSocketServer | null = null

export function createWsServer(server: Server): WebSocketServer {
  wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws) => {
    console.log('[WS] Client connected')
    ws.on('close', () => console.log('[WS] Client disconnected'))
    ws.on('error', (err) => console.error('[WS] Error:', err))

    // Acknowledge connection
    ws.send(JSON.stringify({ type: 'connected', message: 'Aegis WebSocket ready' }))
  })

  return wss
}

export type WsEventType =
  | 'run:started'
  | 'run:event'
  | 'run:completed'
  | 'run:failed'
  | 'approval:requested'
  | 'approval:resolved'

export interface WsEvent {
  type: WsEventType
  runId: string
  payload: Record<string, unknown>
  timestamp: string
}

export function broadcast(event: WsEvent): void {
  if (!wss) return
  const message = JSON.stringify(event)
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message)
    }
  })
}

// Broadcast to clients subscribed to a specific run
export function broadcastToRun(runId: string, event: WsEvent): void {
  broadcast(event) // Simple broadcast for now; can filter by runId later
}
